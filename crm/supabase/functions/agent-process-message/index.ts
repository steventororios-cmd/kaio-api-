/**
 * Agente de ventas de IA — Fase 3 (texto) + Fase 4 (audio/imagen/generación
 * de fotos). Se dispara vía un trigger de base de datos (ver migración
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
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { SUPABASE_URL, SERVICE_ROLE_KEY, OPENAI_API_KEY } from './config.ts';
import { isWithinMessagingWindow, sendTextViaMeta } from './meta.ts';
import { callOpenAI, transcribeAudio, analyzeImage, type ChatMessage } from './openai.ts';
import { buildSystemPrompt, messageToChatContent } from './prompt.ts';
import { buildTools, executeTool } from './tools.ts';
import { ensureMediaDownloaded } from './media.ts';

const HANDLED_CONTENT_TYPES = new Set(['text', 'audio', 'image']);

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
    if (!HANDLED_CONTENT_TYPES.has(message.content_type)) {
      // video/document/sticker/location: fuera de alcance — el dueño lo ve
      // en el inbox y responde a mano si hace falta.
      return json({ skipped: true, reason: `content_type '${message.content_type}' not handled` });
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

    const contact = conversation.contacts;

    // ── Preprocesamiento de audio/imagen (Fase 4) ──────────────────────
    // Se hace ANTES de revisar si la IA está activa: transcribir/analizar
    // le sirve igual al dueño para leer el inbox rápido, aunque la IA no
    // vaya a contestar sola.
    if (message.content_type === 'audio' || message.content_type === 'image') {
      if (OPENAI_API_KEY) {
        try {
          const media = await ensureMediaDownloaded(db, message);
          if (media) {
            if (message.content_type === 'audio') {
              const { data: blob, error } = await db.storage.from('inbound-media').download(media.storagePath);
              if (error) throw new Error(`No se pudo leer el audio de Storage: ${error.message}`);
              const transcript = await transcribeAudio(blob);
              await db.from('messages').update({ transcript }).eq('id', message.id);
              message.transcript = transcript;
            } else {
              const { data: signed, error } = await db.storage
                .from('inbound-media')
                .createSignedUrl(media.storagePath, 300);
              if (error) throw new Error(`No se pudo firmar la URL de la imagen: ${error.message}`);
              const analysis = await analyzeImage(signed.signedUrl);
              await db.from('messages').update({ vision_analysis: analysis }).eq('id', message.id);
              message.vision_analysis = analysis;
            }
          }
        } catch (e) {
          console.error('Error procesando media entrante:', e);
          await logEvent(db, {
            event_type: 'media_processing_failed',
            actor: 'system',
            contact_id: contact?.id,
            conversation_id: conversation.id,
            payload: { error: e instanceof Error ? e.message : String(e), content_type: message.content_type },
          });
          // Seguimos igual: el dueño puede responder a mano aunque la
          // transcripción/análisis haya fallado.
        }
      }
    }

    const { data: agentSettings } = await db.from('agent_settings').select('*').eq('id', true).single();
    if (!agentSettings?.autonomous_enabled) return json({ skipped: true, reason: 'AI disabled globally' });
    if (!conversation.ai_enabled) return json({ skipped: true, reason: 'AI disabled for this conversation' });
    if (!OPENAI_API_KEY) return json({ skipped: true, reason: 'OPENAI_API_KEY not configured' });

    if ((message.content_type === 'audio' && !message.transcript) || (message.content_type === 'image' && !message.vision_analysis)) {
      // No se pudo procesar el media (sin referencia válida, o falló arriba) — no hay nada que darle al modelo.
      return json({ skipped: true, reason: 'media could not be processed into text context' });
    }

    // ── Debounce (Fase 5) ────────────────────────────────────────────
    // Si el lead manda varios mensajes seguidos ("Hola" / "quiero info" /
    // "del tour a Guatapé"), cada uno dispara su propia invocación. Solo
    // el mensaje que sigue siendo el más reciente al cabo de una breve
    // espera genera una respuesta — los anteriores ceden el turno (su
    // contenido ya queda incluido en el historial que usará el último),
    // evitando 3 respuestas separadas y descoordinadas.
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const { data: latestInbound } = await db
      .from('messages')
      .select('id')
      .eq('conversation_id', conversation.id)
      .eq('direction', 'inbound')
      .eq('sender_type', 'contact')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestInbound && latestInbound.id !== message.id) {
      return json({ skipped: true, reason: 'debounced: a newer message arrived, deferring to it' });
    }

    const { data: tours } = await db
      .from('tours')
      .select(
        'slug, name, category, tag, price_cop, price_unit, duration, schedule_text, pickup_text, includes, highlights, note'
      )
      .eq('active', true);

    const { data: history } = await db
      .from('messages')
      .select('direction, sender_type, text_body, transcript, vision_analysis, content_type, created_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(20);
    const chronological = (history ?? []).slice().reverse();

    const systemPrompt = buildSystemPrompt(agentSettings.system_prompt, tours ?? [], contact);
    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      // deno-lint-ignore no-explicit-any
      ...chronological.map((m: any) => ({
        role: m.direction === 'inbound' ? ('user' as const) : ('assistant' as const),
        content: messageToChatContent(m),
      })),
    ];

    const tools = buildTools();
    const completion = await callOpenAI(agentSettings.model, agentSettings.temperature, chatMessages, tools);
    const assistantMessage = completion.choices[0].message;

    const toolCalls = assistantMessage.tool_calls ?? [];
    // deno-lint-ignore no-explicit-any
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
      // deno-lint-ignore no-explicit-any
      payload: { tool_calls: toolCalls.map((c: any) => c.function.name), has_reply: !!replyText, content_type: message.content_type },
    });

    if (!replyText) {
      // El modelo solo ejecutó tools (p. ej. handoff_to_human, o send_tour_photo sin texto adicional) sin generar texto.
      // deno-lint-ignore no-explicit-any
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
        sendError =
          'Fuera de la ventana de 24 horas — la IA no envía plantillas por su cuenta; el dueño puede reabrir la conversación con una plantilla aprobada desde el inbox.';
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

    // deno-lint-ignore no-explicit-any
    return json({ ok: true, reply: replyText, sendError, toolCalls: toolCalls.map((c: any) => c.function.name) });
  } catch (err) {
    console.error('agent-process-message error:', err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

async function logEvent(
  // deno-lint-ignore no-explicit-any
  db: any,
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
