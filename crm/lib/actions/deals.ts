'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logEvent } from './events';

export async function createDeal(formData: FormData) {
  const contact_id = String(formData.get('contact_id') ?? '');
  const stage_id = String(formData.get('stage_id') ?? '');
  const tour_id = String(formData.get('tour_id') ?? '') || null;
  const title = String(formData.get('title') ?? '').trim() || null;
  const value_cop = formData.get('value_cop') ? Number(formData.get('value_cop')) : null;
  const pax = formData.get('pax') ? Number(formData.get('pax')) : null;
  const tour_date = String(formData.get('tour_date') ?? '') || null;

  if (!contact_id || !stage_id) return;

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('deals')
    .insert({ contact_id, stage_id, tour_id, title, value_cop, pax, tour_date, source: 'internal' })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  await logEvent({ event_type: 'deal_created', actor: 'owner', contact_id, deal_id: data.id });
  revalidatePath('/pipeline');
  revalidatePath(`/contacts/${contact_id}`);
}

export async function moveDealStage(dealId: string, stageId: string) {
  const db = supabaseAdmin();
  const { data: stage } = await db
    .from('pipeline_stages')
    .select('is_won, is_lost')
    .eq('id', stageId)
    .single();

  const closed_at = stage && (stage.is_won || stage.is_lost) ? new Date().toISOString() : null;

  const { error, data } = await db
    .from('deals')
    .update({ stage_id: stageId, updated_at: new Date().toISOString(), closed_at })
    .eq('id', dealId)
    .select('contact_id')
    .single();

  if (error) throw new Error(error.message);

  await logEvent({
    event_type: 'deal_stage_changed',
    actor: 'owner',
    contact_id: data?.contact_id,
    deal_id: dealId,
    payload: { stage_id: stageId },
  });
  revalidatePath('/pipeline');
}
