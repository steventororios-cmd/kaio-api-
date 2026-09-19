import { supabaseAdmin } from '@/lib/supabase/server';
import type { Json } from '@/lib/database.types';

export async function logEvent(params: {
  event_type: string;
  actor: string;
  contact_id?: string | null;
  conversation_id?: string | null;
  deal_id?: string | null;
  payload?: Json;
}) {
  const db = supabaseAdmin();
  const { error } = await db.from('events').insert({
    event_type: params.event_type,
    actor: params.actor,
    contact_id: params.contact_id ?? null,
    conversation_id: params.conversation_id ?? null,
    deal_id: params.deal_id ?? null,
    payload: params.payload ?? null,
  });
  if (error) console.error('logEvent failed:', error.message);
}
