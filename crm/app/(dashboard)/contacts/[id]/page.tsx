import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/server';
import { PageHeader, Card, Input, Button, Badge, Textarea } from '@/components/ui';
import { updateContact, addNote, addTagToContact, removeTagFromContact } from '@/lib/actions/contacts';
import { formatCOP } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: contactId } = await params;
  const db = supabaseAdmin();

  const { data: contact } = await db.from('contacts').select('*').eq('id', contactId).maybeSingle();
  if (!contact) notFound();

  const [{ data: notes }, { data: contactTags }, { data: deals }, { data: tasks }] = await Promise.all([
    db.from('notes').select('*').eq('contact_id', contactId).order('created_at', { ascending: false }),
    db.from('contact_tags').select('tag_id, tags(id, name, color)').eq('contact_id', contactId),
    db
      .from('deals')
      .select('id, title, value_cop, pax, tour_date, pipeline_stages(name)')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false }),
    db.from('tasks').select('*').eq('contact_id', contactId).order('due_at', { ascending: true }),
  ]);

  const boundUpdate = updateContact.bind(null, contactId);
  const boundAddNote = addNote.bind(null, contactId);

  return (
    <div>
      <PageHeader title={contact.full_name || 'Contacto'} description={contact.phone ?? undefined} />
      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-gray-900">Perfil</h2>
            <form action={boundUpdate} className="mt-3 grid grid-cols-2 gap-3">
              <Input name="full_name" defaultValue={contact.full_name ?? ''} placeholder="Nombre" />
              <Input name="phone" defaultValue={contact.phone ?? ''} placeholder="Teléfono" />
              <Input name="email" defaultValue={contact.email ?? ''} placeholder="Email" />
              <Input name="city" defaultValue={contact.city ?? ''} placeholder="Ciudad" />
              <Button type="submit" className="col-span-2 w-fit">
                Guardar
              </Button>
            </form>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {(contactTags ?? []).map((t: any) => (
                <form key={t.tag_id} action={removeTagFromContact.bind(null, contactId, t.tag_id)}>
                  <button type="submit">
                    <Badge className="cursor-pointer bg-gray-100 text-gray-700 hover:bg-gray-200">
                      {t.tags?.name} ✕
                    </Badge>
                  </button>
                </form>
              ))}
              <form
                action={async (formData: FormData) => {
                  'use server';
                  await addTagToContact(contactId, String(formData.get('tag') ?? ''));
                }}
                className="flex items-center gap-1"
              >
                <input
                  name="tag"
                  placeholder="+ tag"
                  className="w-24 rounded-md border border-gray-300 px-2 py-1 text-xs"
                />
              </form>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-gray-900">Notas</h2>
            <form action={boundAddNote} className="mt-3 flex gap-2">
              <Textarea name="body" placeholder="Agregar una nota…" rows={2} />
              <Button type="submit">Guardar</Button>
            </form>
            <div className="mt-4 space-y-3">
              {(notes ?? []).map((n) => (
                <div key={n.id} className="border-l-2 border-gray-200 pl-3 text-sm">
                  <p className="text-gray-700">{n.body}</p>
                  <p className="text-xs text-gray-400">
                    {n.author} · {new Date(n.created_at).toLocaleString('es-CO')}
                  </p>
                </div>
              ))}
              {(notes ?? []).length === 0 && <p className="text-sm text-gray-400">Sin notas todavía.</p>}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-gray-900">Deals</h2>
            <div className="mt-3 space-y-2">
              {(deals ?? []).map((d: any) => (
                <div key={d.id} className="rounded-md border border-gray-100 p-2 text-sm">
                  <p className="font-medium text-gray-900">{d.title || 'Deal'}</p>
                  <p className="text-xs text-gray-500">
                    {d.pipeline_stages?.name} · {formatCOP(d.value_cop)} · {d.pax ?? '?'} pax
                  </p>
                </div>
              ))}
              {(deals ?? []).length === 0 && <p className="text-sm text-gray-400">Sin deals.</p>}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-gray-900">Tareas</h2>
            <div className="mt-3 space-y-2">
              {(tasks ?? []).map((t) => (
                <div key={t.id} className="text-sm">
                  <p className={t.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-800'}>
                    {t.title}
                  </p>
                  {t.due_at && (
                    <p className="text-xs text-gray-400">{new Date(t.due_at).toLocaleDateString('es-CO')}</p>
                  )}
                </div>
              ))}
              {(tasks ?? []).length === 0 && <p className="text-sm text-gray-400">Sin tareas.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
