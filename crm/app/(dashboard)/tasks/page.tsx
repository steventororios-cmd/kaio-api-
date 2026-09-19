import { supabaseAdmin } from '@/lib/supabase/server';
import { PageHeader, Card, Input, Select, Button } from '@/components/ui';
import { createTask } from '@/lib/actions/tasks';
import { TaskCheckbox } from '@/components/TaskCheckbox';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const db = supabaseAdmin();
  const [{ data: tasks }, { data: contacts }] = await Promise.all([
    db
      .from('tasks')
      .select('id, title, description, due_at, status, created_by, contacts(id, full_name)')
      .order('status')
      .order('due_at', { ascending: true, nullsFirst: false }),
    db.from('contacts').select('id, full_name').order('full_name'),
  ]);

  return (
    <div>
      <PageHeader title="Tareas" description="Seguimientos pendientes" />
      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <ul className="divide-y divide-gray-100">
              {(tasks ?? []).map((t: any) => (
                <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                  <TaskCheckbox taskId={t.id} done={t.status === 'done'} />
                  <div className="flex-1">
                    <p className={t.status === 'done' ? 'text-sm text-gray-400 line-through' : 'text-sm text-gray-900'}>
                      {t.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t.contacts?.full_name && `${t.contacts.full_name} · `}
                      {t.due_at
                        ? new Date(t.due_at).toLocaleString('es-CO')
                        : 'Sin fecha'}
                      {t.created_by === 'ai' && ' · creada por IA'}
                    </p>
                  </div>
                </li>
              ))}
              {(tasks ?? []).length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-gray-400">Sin tareas.</li>
              )}
            </ul>
          </Card>
        </div>
        <Card className="h-fit p-4">
          <h2 className="text-sm font-semibold text-gray-900">Nueva tarea</h2>
          <form action={createTask} className="mt-3 space-y-3">
            <Input name="title" placeholder="Título" required />
            <Select name="contact_id">
              <option value="">Sin contacto asociado</option>
              {(contacts ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </Select>
            <Input name="due_at" type="datetime-local" />
            <Button type="submit" className="w-full">
              Crear tarea
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
