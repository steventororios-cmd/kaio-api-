'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/server';
import { logEvent } from './events';

export async function createContact(formData: FormData) {
  const full_name = String(formData.get('full_name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const email = String(formData.get('email') ?? '').trim() || null;
  const city = String(formData.get('city') ?? '').trim() || null;

  if (!full_name) return;

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('contacts')
    .insert({ full_name, phone, email, city })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  await logEvent({ event_type: 'contact_created', actor: 'owner', contact_id: data.id });
  revalidatePath('/contacts');
  redirect(`/contacts/${data.id}`);
}

export async function updateContact(contactId: string, formData: FormData) {
  const db = supabaseAdmin();
  const full_name = String(formData.get('full_name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const email = String(formData.get('email') ?? '').trim() || null;
  const city = String(formData.get('city') ?? '').trim() || null;

  const { error } = await db
    .from('contacts')
    .update({ full_name, phone, email, city, updated_at: new Date().toISOString() })
    .eq('id', contactId);

  if (error) throw new Error(error.message);
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath('/contacts');
}

export async function addNote(contactId: string, formData: FormData) {
  const body = String(formData.get('body') ?? '').trim();
  if (!body) return;

  const db = supabaseAdmin();
  const { error } = await db.from('notes').insert({ contact_id: contactId, body, author: 'owner' });
  if (error) throw new Error(error.message);

  await logEvent({ event_type: 'note_added', actor: 'owner', contact_id: contactId });
  revalidatePath(`/contacts/${contactId}`);
}

export async function addTagToContact(contactId: string, tagName: string) {
  const name = tagName.trim().toLowerCase();
  if (!name) return;

  const db = supabaseAdmin();
  let { data: tag } = await db.from('tags').select('id').eq('name', name).maybeSingle();

  if (!tag) {
    const { data: created, error } = await db.from('tags').insert({ name }).select('id').single();
    if (error) throw new Error(error.message);
    tag = created;
  }

  const { error: linkError } = await db
    .from('contact_tags')
    .upsert({ contact_id: contactId, tag_id: tag.id }, { onConflict: 'contact_id,tag_id' });
  if (linkError) throw new Error(linkError.message);

  revalidatePath(`/contacts/${contactId}`);
}

export async function removeTagFromContact(contactId: string, tagId: string) {
  const db = supabaseAdmin();
  const { error } = await db
    .from('contact_tags')
    .delete()
    .eq('contact_id', contactId)
    .eq('tag_id', tagId);
  if (error) throw new Error(error.message);
  revalidatePath(`/contacts/${contactId}`);
}
