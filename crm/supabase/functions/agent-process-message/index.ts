/**
 * Agente de ventas de IA — Fase 3 (solo texto; audio/imagen llegan en la
 * Fase 4). Se dispara vía un trigger de base de datos (ver migración
 * 0004_ai_agent_trigger.sql) en cada INSERT de un mensaje entrante de un
 * contacto, no directamente por el webhook de Meta — así el ACK a Meta no
 * espera a este procesamiento, que puede tardar varios segundos.
 *
 * El disparador solo manda `{ message_id }`; esta función resuelve todo lo
 * demás (conversación, contacto, catálogo, historial) desde la base de
 * datos, usando su propia service_role key (inyectada automáticamente por
 * Supabase en cada Edge Function — no hace falta configurarla a mano).
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const GRAPH_API_VERSION = 'v21.0';

Deno.serve(async (req: Request) => {
  try {
    const { message_id } = await req.json();
    if (!message_id) return json({ skipped: true, reason: 'no message_id' });

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: message } = await db.from('messages').select('*').eq('id', message_id).maybeSingle();
    if (!message) return json({ skipped: true, reason: 'message not found' });
    if (message.direction !== 'inbound' || message.sender_type !== 'contact') {
      return json({ skipped: true, reason: 'not an inbound contact message' });
    }
    if (message.content_type !== 'text') {
      // Fase 4: transcripción (audio) y visión (imagen). Por ahora el
      // dueño ve el mensaje en el inbox y responde a mano si hace falta.
      return json({ skipped: true, reason: `content_type '${message.content_type}' not yet handled (Phase 4)` });
    }

    // Reclamo atómico: evita procesar dos veces el mismo mensaje si el
    // trigger llegara a dispararse más de una vez.
    const { data: claimed } = await db
      .from('messages')
      .update({ ai_processed: true })
      .eq('id', message.id)
      .eq('ai_processed', false)
      .select('id')
      .maybeSingle();
    if (!claimed) return json({ skipped: true, reason: 'already claimed/processed' });

    const { data: conversation } = await db
      .from('conversations')
      .select('*, contacts(*)')
      .eq('id', message.conversation_id)
      .maybeSingle();
    if (!conversation) return json({ skipped: true, reason: 'conversation not found' });

    const { data: agentSettings } = await db.from('agent_settings').select('*').eq('id', true).single();
    if (!agentSettings?.autonomous_enabled) return json({ skipped: true, reason: 'AI disabled globally' });
    if (!conversation.ai_enabled) return json({ skipped: true, reason: 'AI disabled for this conversation' });
    if (!OPENAI_API_KEY) return json({ skipped: true, reason: 'OPENAI_API_KEY not configured' });

    const contact = conversation.contacts;

    const { data: tours } = await db
      .from('tours')
      .select(
        'slug, name, category, tag, price_cop, price_unit, duration, schedule_text, pickup_text, includes, highlights, note'
      )
      .eq('active', true);

    const { data: history } = await db
      .from('messages')
      .select('direction, sender_type, text_body, transcript, created_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(20);
    const chronological = (history ?? []).slice().reverse();

    const systemPrompt = buildSystemPrompt(agentSettings.system_prompt, tours ?? [], contact);
    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...chronological.map((m: any) => ({
        role: m.direction === 'inbound' ? ('user' as const) : ('assistant' as const),
        content: m.text_body ?? m.transcript ?? '',
      })),
    ];

    const tools = buildTools();
    const completion = await callOpenAI(agentSettings.model, agentSettings.temperature, chatMessages, tools);
    const assistantMessage = completion.choices[0].message;

    const toolCalls = assistantMessage.tool_calls ?? [];
    const toolResults: { call: any; result: unknown }[] = [];
    for (const call of toolCalls) {
      const result = await executeTool(db, call, conversation, contact);
      toolResults.push({ call, result });
    }

    let replyText: string | null = assistantMessage.content ?? null;

    if (toolResults.length > 0) {
      const followupMessages = [
        ...chatMessages,
        { role: 'assistant' as const, content: assistantMessage.content, tool_calls: assistantMessage.tool_calls },
        ...toolResults.map(({ call, result }) => ({
          role: 'tool' as const,
          tool_call_id: call.id,
          content: JSON.stringify(result),
        })),
      ];
      const followup = await callOpenAI(agentSettings.model, agentSettings.temperature, followupMessages, tools);
      replyText = followup.choices[0].message.content ?? null;
    }

    await logEvent(db, {
      event_type: 'ai_processed_message',
      actor: 'ai',
      contact_id: contact.id,
      conversation_id: conversation.id,
      payload: { tool_calls: toolCalls.map((c: any) => c.function.name), has_reply: !!replyText },
    });

    if (!replyText) {
      // El modelo solo ejecutó tools (p. ej. handoff_to_human) sin generar texto.
      return json({ ok: true, toolCalls: toolCalls.map((c: any) => c.function.name) });
    }

    const { data: outboundMessage, error: insertError } = await db
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        direction: 'outbound',
        channel: conversation.channel,
        sender_type: 'agent_ai',
        content_type: 'text',
        text_body: replyText,
        status: conversation.channel === 'internal' ? 'sent' : 'pending_send',
        ai_processed: true,
      })
      .select('id')
      .single();
    if (insertError) throw new Error(insertError.message);

    let sendError: string | null = null;
    if (conversation.channel !== 'internal') {
      const { data: channelRow } = await db
        .from('contact_channels')
        .select('external_id')
        .eq('contact_id', contact.id)
        .eq('channel', conversation.channel)
        .maybeSingle();

      if (!channelRow) {
        sendError = 'No se encontró el identificador externo del contacto para este canal.';
      } else if (!isWithinMessagingWindow(conversation.last_inbound_at)) {
        sendError = 'Fuera de la ventana de 24 horas — requiere una plantilla aprobada (Fase 5).';
      } else {
        try {
          const externalId = await sendTextViaMeta(conversation.channel, channelRow.external_id, replyText);
          await db.from('messages').update({ status: 'sent', external_message_id: externalId }).eq('id', outboundMessage.id);
        } catch (e) {
          sendError = e instanceof Error ? e.message : String(e);
        }
      }
      if (sendError) {
        await db
          .from('messages')
          .update({ status: 'failed', raw_payload: { error: sendError } })
          .eq('id', outboundMessage.id);
      }
    }

    await db.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversation.id);

    return json({ ok: true, reply: replyText, sendError, toolCalls: toolCalls.map((c: any) => c.function.name) });
  } catch (err) {
    console.error('agent-process-message error:', err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

// ── Contexto ─────────────────────────────────────────────────────────

function buildSystemPrompt(basePrompt: string, tours: any[], contact: any): string {
  const catalog = tours
    .map((t) => {
      const includes = Array.isArray(t.includes) ? t.includes.join(', ') : '';
      const highlights = Array.isArray(t.highlights) ? t.highlights.join(', ') : '';
      return `- ${t.name} (slug: ${t.slug}): ${formatCOP(t.price_cop)} ${t.price_unit ?? ''}. Duración: ${
        t.duration ?? 'N/D'
      }. Horario: ${t.schedule_text ?? 'N/D'}. Punto de encuentro: ${t.pickup_text ?? 'N/D'}. Incluye: ${includes}. Destacados: ${highlights}.${
        t.note ? ` Nota: ${t.note}` : ''
      }`;
    })
    .join('\n');

  return `${basePrompt}

CATÁLOGO ACTUAL DE TOURS (única fuente de verdad para precios/horarios/inclusiones — nunca inventes datos que no estén aquí; si te preguntan algo que no está, dilo y ofrece agendar seguimiento):
${catalog || '(catálogo vacío)'}

PERFIL DEL CONTACTO:
Nombre: ${contact?.full_name ?? 'desconocido'}
Ciudad: ${contact?.city ?? 'desconocida'}
Idioma preferido: ${contact?.preferred_language ?? 'es'}`;
}

function formatCOP(value: number | null): string {
  if (value === null || value === undefined) return 'precio a consultar';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

// ── Tools ────────────────────────────────────────────────────────────

function buildTools() {
  return [
    {
      type: 'function',
      function: {
        name: 'update_deal_stage',
        description: 'Actualiza la etapa del pipeline de ventas del deal más reciente de este contacto.',
        parameters: {
          type: 'object',
          properties: {
            stage_name: { type: 'string', description: "Nombre de la etapa (p. ej. 'Calificado', 'Propuesta enviada')" },
          },
          required: ['stage_name'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'create_deal',
        description: 'Crea un nuevo deal cuando el lead muestra intención clara de reservar un tour específico del catálogo.',
        parameters: {
          type: 'object',
          properties: {
            tour_slug: { type: 'string', description: 'El slug del tour, tal como aparece en el catálogo' },
            pax: { type: 'number', description: 'Número de personas' },
            tour_date: { type: 'string', description: 'Fecha deseada en formato YYYY-MM-DD, si se mencionó' },
          },
          required: ['tour_slug'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'schedule_followup_task',
        description: 'Agenda una tarea de seguimiento para el dueño del negocio.',
        parameters: {
          type: 'object',
          properties: {
            note: { type: 'string', description: 'Qué hay que hacer o recordar' },
            due_in_hours: { type: 'number', description: 'En cuántas horas debería hacerse el seguimiento (default 24)' },
          },
          required: ['note'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'add_tag',
        description: "Agrega una etiqueta al contacto (p. ej. 'interesado-guatape', 'grupo-grande', 'urgente').",
        parameters: {
          type: 'object',
          properties: { tag: { type: 'string' } },
          required: ['tag'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'send_tour_photo',
        description: 'Envía una foto real del tour al lead, como lo haría un agente humano.',
        parameters: {
          type: 'object',
          properties: { tour_slug: { type: 'string' } },
          required: ['tour_slug'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'handoff_to_human',
        description:
          'Pasa la conversación a un humano y pausa las respuestas automáticas. Úsalo ante quejas, disputas de pago, solicitudes explícitas de hablar con una persona, o cualquier cosa fuera del alcance de reservas/tours.',
        parameters: {
          type: 'object',
          properties: { reason: { type: 'string' } },
          required: ['reason'],
        },
      },
    },
  ];
}

async function executeTool(db: SupabaseClient, call: any, conversation: any, contact: any): Promise<unknown> {
  const name = call.function.name;
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(call.function.arguments || '{}');
  } catch {
    return { error: 'No se pudo interpretar los argumentos de la tool' };
  }

  switch (name) {
    case 'update_deal_stage': {
      const { data: stage } = await db
        .from('pipeline_stages')
        .select('id')
        .ilike('name', String(args.stage_name))
        .maybeSingle();
      if (!stage) return { error: `Etapa no encontrada: ${args.stage_name}` };

      const { data: deal } = await db
        .from('deals')
        .select('id')
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!deal) return { error: 'No hay ningún deal activo para este contacto — usa create_deal primero.' };

      await db.from('deals').update({ stage_id: stage.id, updated_at: new Date().toISOString() }).eq('id', deal.id);
      await logEvent(db, {
        event_type: 'deal_stage_changed',
        actor: 'ai',
        contact_id: contact.id,
        conversation_id: conversation.id,
        deal_id: deal.id,
        payload: { stage: args.stage_name },
      });
      return { ok: true };
    }

    case 'create_deal': {
      const { data: tour } = await db.from('tours').select('id, name, price_cop').eq('slug', args.tour_slug).maybeSingle();
      if (!tour) return { error: `Tour no encontrado: ${args.tour_slug}` };

      const { data: firstStage } = await db.from('pipeline_stages').select('id').order('position').limit(1).single();

      const { data: deal, error } = await db
        .from('deals')
        .insert({
          contact_id: contact.id,
          tour_id: tour.id,
          stage_id: firstStage.id,
          title: tour.name,
          value_cop: tour.price_cop,
          pax: (args.pax as number) ?? null,
          tour_date: (args.tour_date as string) ?? null,
          source: conversation.channel,
        })
        .select('id')
        .single();
      if (error) return { error: error.message };

      await db.from('conversations').update({ deal_id: deal.id }).eq('id', conversation.id);
      await logEvent(db, {
        event_type: 'deal_created',
        actor: 'ai',
        contact_id: contact.id,
        conversation_id: conversation.id,
        deal_id: deal.id,
        payload: { tour: args.tour_slug },
      });
      return { ok: true, deal_id: deal.id };
    }

    case 'schedule_followup_task': {
      const dueInHours = typeof args.due_in_hours === 'number' ? args.due_in_hours : 24;
      const dueAt = new Date(Date.now() + dueInHours * 3600_000).toISOString();
      await db.from('tasks').insert({
        contact_id: contact.id,
        conversation_id: conversation.id,
        title: String(args.note ?? 'Seguimiento'),
        due_at: dueAt,
        created_by: 'ai',
      });
      return { ok: true };
    }

    case 'add_tag': {
      const tagName = String(args.tag ?? '').trim().toLowerCase();
      if (!tagName) return { error: 'tag vacío' };
      let { data: tag } = await db.from('tags').select('id').eq('name', tagName).maybeSingle();
      if (!tag) {
        const { data: created, error } = await db.from('tags').insert({ name: tagName }).select('id').single();
        if (error) return { error: error.message };
        tag = created;
      }
      await db.from('contact_tags').upsert({ contact_id: contact.id, tag_id: tag.id }, { onConflict: 'contact_id,tag_id' });
      return { ok: true };
    }

    case 'send_tour_photo': {
      const { data: tour } = await db.from('tours').select('id, name').eq('slug', args.tour_slug).maybeSingle();
      if (!tour) return { error: `Tour no encontrado: ${args.tour_slug}` };

      const { data: media } = await db
        .from('tour_media')
        .select('storage_path')
        .eq('tour_id', tour.id)
        .eq('is_primary', true)
        .maybeSingle();

      if (!media) {
        // Fase 4: generación de imagen de respaldo con gpt-image-1 cuando no hay foto real.
        return {
          error: 'no_photo_available',
          note: 'Todavía no hay foto de catálogo para este tour — responde solo con texto por ahora.',
        };
      }

      const { data: publicUrl } = db.storage.from('tour-media').getPublicUrl(media.storage_path);

      if (conversation.channel !== 'internal') {
        const { data: channelRow } = await db
          .from('contact_channels')
          .select('external_id')
          .eq('contact_id', contact.id)
          .eq('channel', conversation.channel)
          .maybeSingle();
        if (channelRow) {
          try {
            await sendImageViaMeta(conversation.channel, channelRow.external_id, publicUrl.publicUrl);
          } catch (e) {
            return { error: e instanceof Error ? e.message : String(e) };
          }
        }
      }

      await db.from('messages').insert({
        conversation_id: conversation.id,
        direction: 'outbound',
        channel: conversation.channel,
        sender_type: 'agent_ai',
        content_type: 'image',
        media_storage_path: media.storage_path,
        status: 'sent',
        ai_processed: true,
      });
      return { ok: true, sent: true };
    }

    case 'handoff_to_human': {
      await db.from('conversations').update({ ai_enabled: false }).eq('id', conversation.id);
      await db.from('tasks').insert({
        contact_id: contact.id,
        conversation_id: conversation.id,
        title: `Handoff de IA: ${args.reason ?? 'sin motivo especificado'}`,
        due_at: new Date().toISOString(),
        created_by: 'ai',
      });
      await logEvent(db, {
        event_type: 'handoff_triggered',
        actor: 'ai',
        contact_id: contact.id,
        conversation_id: conversation.id,
        payload: { reason: args.reason },
      });
      return { ok: true };
    }

    default:
      return { error: `Tool desconocida: ${name}` };
  }
}

// ── OpenAI ───────────────────────────────────────────────────────────

type ChatMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; tool_call_id?: string; tool_calls?: unknown };

async function callOpenAI(model: string, temperature: number, messages: ChatMessage[], tools: unknown[]): Promise<any> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, temperature, messages, tools, tool_choice: 'auto' }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${text}`);
  }
  return res.json();
}

// ── Envío por Meta (duplicado minimal de lib/meta/send.ts — Deno no
//    comparte módulos con la app Next.js) ───────────────────────────

const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;

function isWithinMessagingWindow(lastInboundAt: string | null): boolean {
  if (!lastInboundAt) return false;
  return Date.now() - new Date(lastInboundAt).getTime() < MESSAGING_WINDOW_MS;
}

async function sendTextViaMeta(channel: string, externalId: string, text: string): Promise<string | undefined> {
  if (channel === 'whatsapp') {
    const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    if (!token || !phoneId) throw new Error('WhatsApp no está configurado (faltan credenciales)');
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: externalId, type: 'text', text: { body: text } }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`WhatsApp send failed: ${JSON.stringify(data)}`);
    return data.messages?.[0]?.id;
  }

  const tokenEnvVar = channel === 'messenger' ? 'MESSENGER_PAGE_ACCESS_TOKEN' : 'INSTAGRAM_ACCESS_TOKEN';
  const token = Deno.env.get(tokenEnvVar);
  if (!token) throw new Error(`${channel} no está configurado (falta ${tokenEnvVar})`);
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages?access_token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: externalId }, message: { text } }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`${channel} send failed: ${JSON.stringify(data)}`);
  return data.message_id;
}

async function sendImageViaMeta(channel: string, externalId: string, imageUrl: string): Promise<string | undefined> {
  if (channel === 'whatsapp') {
    const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    if (!token || !phoneId) throw new Error('WhatsApp no está configurado (faltan credenciales)');
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: externalId, type: 'image', image: { link: imageUrl } }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`WhatsApp send failed: ${JSON.stringify(data)}`);
    return data.messages?.[0]?.id;
  }

  const tokenEnvVar = channel === 'messenger' ? 'MESSENGER_PAGE_ACCESS_TOKEN' : 'INSTAGRAM_ACCESS_TOKEN';
  const token = Deno.env.get(tokenEnvVar);
  if (!token) throw new Error(`${channel} no está configurado (falta ${tokenEnvVar})`);
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/me/messages?access_token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: externalId }, message: { attachment: { type: 'image', payload: { url: imageUrl } } } }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`${channel} send failed: ${JSON.stringify(data)}`);
  return data.message_id;
}

// ── Utilidades ───────────────────────────────────────────────────────

async function logEvent(
  db: SupabaseClient,
  params: {
    event_type: string;
    actor: string;
    contact_id?: string | null;
    conversation_id?: string | null;
    deal_id?: string | null;
    payload?: Record<string, unknown>;
  }
) {
  await db.from('events').insert({
    event_type: params.event_type,
    actor: params.actor,
    contact_id: params.contact_id ?? null,
    conversation_id: params.conversation_id ?? null,
    deal_id: params.deal_id ?? null,
    payload: params.payload ?? null,
  });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
