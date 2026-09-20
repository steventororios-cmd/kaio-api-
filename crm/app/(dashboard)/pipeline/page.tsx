import { supabaseAdmin } from '@/lib/supabase/server';
import { PageHeader, Card, Select, Input, Button } from '@/components/ui';
import { createDeal } from '@/lib/actions/deals';
import { PipelineBoard } from '@/components/PipelineBoard';

export const dynamic = 'force-dynamic';

export default async function PipelinePage() {
  const db = supabaseAdmin();

  const [{ data: stages }, { data: deals }, { data: contacts }, { data: tours }] = await Promise.all([
    db.from('pipeline_stages').select('*').order('position'),
    db
      .from('deals')
      .select('id, title, value_cop, pax, tour_date, stage_id, contacts(id, full_name)')
      .order('created_at', { ascending: false }),
    db.from('contacts').select('id, full_name').order('full_name'),
    db.from('tours').select('id, name').eq('active', true).order('name'),
  ]);

  return (
    <div>
      <PageHeader
        title="Pipeline"
        description="Etapas de venta"
        actions={
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white">
              + Nuevo deal
            </summary>
            <Card className="absolute right-0 z-10 mt-2 w-72 p-4 shadow-lg">
              <form action={createDeal} className="space-y-2">
                <Select name="contact_id" required>
                  <option value="">Contacto…</option>
                  {(contacts ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name || c.id}
                    </option>
                  ))}
                </Select>
                <Select name="stage_id" required>
                  {(stages ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
                <Select name="tour_id">
                  <option value="">Tour (opcional)…</option>
                  {(tours ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
                <Input name="title" placeholder="Título" />
                <Input name="value_cop" placeholder="Valor (COP)" type="number" />
                <Input name="pax" placeholder="# personas" type="number" />
                <Input name="tour_date" type="date" />
                <Button type="submit" className="w-full">
                  Crear
                </Button>
              </form>
            </Card>
          </details>
        }
      />

      <PipelineBoard stages={stages ?? []} deals={(deals ?? []) as any} />
    </div>
  );
}
