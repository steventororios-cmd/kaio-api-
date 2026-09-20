'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/server';
import { sendMessage, isWithinMessagingWindow } from '@/lib/meta/send';
import { logEvent } from './events';

/**
 * Envía un mensaje "manual" desde el panel: para canales reales
 * (WhatsApp/Instagram/Messenger) lo manda de verdad vía Graph API antes de
 * guardarlo; para conversaciones internas solo lo guarda. Escribir a mano
 * apaga el piloto automático de la IA para esa conversación (tomar el
 * control).
 */
export async function sendManualMessage(conversationId: string, formData: FormData) {
  const text_body = String(formData.get('text_body') ?? '').trim();
  if (!text_body) return;

  const db = supabaseAdmin();
  const { data: conversation, error: convError } = await db
    .from('conversations')
    .select('id, channel, contact_id, last_inbound_at')
    .eq('id', conversationId)
    .single();
  if (convError || !conversation) throw new Error(convError?.message ?? 'Conversación no encontrada');

  let externalMessageId: string | null = null;
  let sendError: string | null = null;

  if (conversation.channel !== 'internal') {
    const { data: channelRow } = await db
      .from('contact_channels')
      .select('external_id')
      .eq('contact_id', conversation.contact_id)
      .eq('channel', conversation.channel)
      .maybeSingle();

    if (!channelRow) {
      sendError = 'No se encontró el identificador de este contacto para el canal — no se pudo enviar.';
    } else if (!isWithinMessagingWindow(conversation.last_inbound_at)) {
      sendError =
        'Fuera de la ventana de 24 horas desde el último mensaje del lead: usa una plantilla aprobada para reabrir la conversación (Fase 5).';
    } else {
      try {
        externalMessageId = await sendMessage(conversation.channel, channelRow.external_id, {
          type: 'text',
          text: text_body,
        });
      } catch (e) {
        sendError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  const { error } = await db.from('messages').insert({
    conversation_id: conversationId,
    direction: 'outbound',
    channel: conversation.channel,
    external_message_id: externalMessageId,
    sender_type: 'agent_human',
    content_type: 'text',
    text_body,
    status: sendError ? 'failed' : 'sent',
    raw_payload: sendError ? { error: sendError } : null,
  });
  if (error) throw new Error(error.message);

  await db
    .from('conversations')
    .update({ ai_enabled: false, last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  await logEvent({
    event_type: sendError ? 'manual_reply_failed' : 'manual_reply_sent',
    actor: 'owner',
    contact_id: conversation.contact_id,
    conversation_id: conversationId,
    payload: sendError ? { error: sendError } : undefined,
  });

  revalidatePath(`/inbox`);
}

export async function toggleAiEnabled(conversationId: string, enabled: boolean) {
  const db = supabaseAdmin();
  const { error } = await db
    .from('conversations')
    .update({ ai_enabled: enabled })
    .eq('id', conversationId);
  if (error) throw new Error(error.message);

  await logEvent({
    event_type: enabled ? 'ai_resumed' : 'ai_paused',
    actor: 'owner',
    conversation_id: conversationId,
  });

  revalidatePath('/inbox');
}

export async function markConversationRead(conversationId: string) {
  const db = supabaseAdmin();
  await db.from('conversations').update({ unread_count: 0 }).eq('id', conversationId);
  revalidatePath('/inbox');
}

/**
 * Crea (o reutiliza) una conversación "internal" para un contacto — útil
 * para dejar notas/seguimiento en el inbox antes de tener canales reales
 * conectados.
 */
export async function startInternalConversation(contactId: string) {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('conversations')
    .upsert(
      { contact_id: contactId, channel: 'internal', ai_enabled: false },
      { onConflict: 'contact_id,channel' }
    )
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}
