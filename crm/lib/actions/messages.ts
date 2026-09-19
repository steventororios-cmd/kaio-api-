'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logEvent } from './events';

/**
 * Fase 1: envía un mensaje "manual" desde el panel. Se guarda en `messages`
 * como saliente de un humano y apaga el piloto automático de la IA para esa
 * conversación (escribir manualmente = tomar el control). El envío real por
 * WhatsApp/Instagram/Messenger se conecta en la Fase 2 (lib/meta/send.ts).
 */
export async function sendManualMessage(conversationId: string, formData: FormData) {
  const text_body = String(formData.get('text_body') ?? '').trim();
  if (!text_body) return;

  const db = supabaseAdmin();
  const { data: conversation, error: convError } = await db
    .from('conversations')
    .select('id, channel, contact_id')
    .eq('id', conversationId)
    .single();
  if (convError || !conversation) throw new Error(convError?.message ?? 'Conversación no encontrada');

  const { error } = await db.from('messages').insert({
    conversation_id: conversationId,
    direction: 'outbound',
    channel: conversation.channel,
    sender_type: 'agent_human',
    content_type: 'text',
    text_body,
    status: conversation.channel === 'internal' ? 'sent' : 'pending_send',
  });
  if (error) throw new Error(error.message);

  await db
    .from('conversations')
    .update({ ai_enabled: false, last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  await logEvent({
    event_type: 'manual_reply_sent',
    actor: 'owner',
    contact_id: conversation.contact_id,
    conversation_id: conversationId,
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
