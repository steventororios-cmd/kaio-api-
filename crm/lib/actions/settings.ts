'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function updateAgentSettings(formData: FormData) {
  const system_prompt = String(formData.get('system_prompt') ?? '');
  const autonomous_enabled = formData.get('autonomous_enabled') === 'on';
  const temperature = Number(formData.get('temperature') ?? 0.4);

  const db = supabaseAdmin();
  const { error } = await db
    .from('agent_settings')
    .update({
      system_prompt,
      autonomous_enabled,
      temperature,
      updated_at: new Date().toISOString(),
    })
    .eq('id', true);

  if (error) throw new Error(error.message);
  revalidatePath('/settings');
}
