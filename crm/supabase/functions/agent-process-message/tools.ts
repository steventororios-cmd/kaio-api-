import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { OPENAI_API_KEY } from './config.ts';
import { sendImageViaMeta } from './meta.ts';
import { generateImage } from './openai.ts';

export function buildTools() {
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
        description:
          'Envía una foto del tour al lead, como lo haría un agente humano. Si el catálogo todavía no tiene una foto real para ese tour, genera una automáticamente.',
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
          'Pasa la conversación a un humano y pausa las respuestas automáticas. Úsalo ante quejas, disputas de pago, comprobantes dudosos, solicitudes explícitas de hablar con una persona, o cualquier cosa fuera del alcance de reservas/tours.',
        parameters: {
          type: 'object',
          properties: { reason: { type: 'string' } },
          required: ['reason'],
        },
      },
    },
  ];
}

export async function executeTool(
  // deno-lint-ignore no-explicit-any
  db: SupabaseClient,
  // deno-lint-ignore no-explicit-any
  call: any,
  // deno-lint-ignore no-explicit-any
  conversation: any,
  // deno-lint-ignore no-explicit-any
  contact: any
): Promise<unknown> {
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
      return sendTourPhoto(db, conversation, contact, String(args.tour_slug ?? ''));
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

async function sendTourPhoto(
  // deno-lint-ignore no-explicit-any
  db: SupabaseClient,
  // deno-lint-ignore no-explicit-any
  conversation: any,
  // deno-lint-ignore no-explicit-any
  contact: any,
  tourSlug: string
): Promise<unknown> {
  const { data: tour } = await db.from('tours').select('id, name, tag, highlights').eq('slug', tourSlug).maybeSingle();
  if (!tour) return { error: `Tour no encontrado: ${tourSlug}` };

  let { data: media } = await db
    .from('tour_media')
    .select('storage_path, source')
    .eq('tour_id', tour.id)
    .eq('is_primary', true)
    .maybeSingle();

  if (!media) {
    // Fase 4: no hay foto real todavía — genera una de respaldo con IA. El
    // dueño puede reemplazarla luego subiendo la foto real al catálogo.
    if (!OPENAI_API_KEY) {
      return {
        error: 'no_photo_available',
        note: 'No hay foto de catálogo y no se puede generar una (falta OPENAI_API_KEY) — responde solo con texto.',
      };
    }
    try {
      const highlights = Array.isArray(tour.highlights) ? tour.highlights.slice(0, 3).join(', ') : '';
      const prompt = `Fotografía realista y atractiva de una experiencia turística en Antioquia, Colombia: ${tour.name}. ${
        tour.tag ?? ''
      }. Destacando: ${highlights}. Estilo fotografía de viajes profesional, luz natural, sin texto ni logos ni marcas de agua.`;
      const bytes = await generateImage(prompt);
      const storagePath = `${tour.id}/generated-${Date.now()}.png`;
      const { error: uploadError } = await db.storage
        .from('generated-media')
        .upload(storagePath, bytes, { contentType: 'image/png' });
      if (uploadError) throw new Error(uploadError.message);

      await db.from('tour_media').insert({ tour_id: tour.id, storage_path: storagePath, is_primary: true, source: 'ai_generated' });
      media = { storage_path: storagePath, source: 'ai_generated' };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }

  const bucket = media.source === 'ai_generated' ? 'generated-media' : 'tour-media';
  const { data: publicUrl } = db.storage.from(bucket).getPublicUrl(media.storage_path);

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
  return { ok: true, sent: true, source: media.source };
}

async function logEvent(
  // deno-lint-ignore no-explicit-any
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
