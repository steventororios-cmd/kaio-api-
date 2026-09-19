'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function createTask(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return;
  const contact_id = String(formData.get('contact_id') ?? '') || null;
  const due_at = String(formData.get('due_at') ?? '') || null;
  const description = String(formData.get('description') ?? '').trim() || null;

  const db = supabaseAdmin();
  const { error } = await db.from('tasks').insert({
    title,
    contact_id,
    due_at,
    description,
    created_by: 'owner',
  });
  if (error) throw new Error(error.message);

  revalidatePath('/tasks');
  if (contact_id) revalidatePath(`/contacts/${contact_id}`);
}

export async function toggleTask(taskId: string, done: boolean) {
  const db = supabaseAdmin();
  const { error } = await db
    .from('tasks')
    .update({ status: done ? 'done' : 'pending' })
    .eq('id', taskId);
  if (error) throw new Error(error.message);
  revalidatePath('/tasks');
}
