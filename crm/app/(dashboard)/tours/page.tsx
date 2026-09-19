import { supabaseAdmin } from '@/lib/supabase/server';
import { PageHeader, Card, Badge } from '@/components/ui';
import { formatCOP } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ToursPage() {
  const db = supabaseAdmin();
  const { data: tours } = await db
    .from('tours')
    .select('*, tour_media(storage_path, is_primary, source)')
    .order('name');

  return (
    <div>
      <PageHeader
        title="Catálogo de tours"
        description="Base de conocimiento del agente de IA — precios y disponibilidad reales, sembrados desde el sitio web"
      />
      <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
        {(tours ?? []).map((t: any) => {
          const primaryMedia = t.tour_media?.find((m: any) => m.is_primary) ?? t.tour_media?.[0];
          return (
            <Card key={t.id} className="overflow-hidden">
              <div className="flex h-32 items-center justify-center bg-gradient-to-br from-brand-100 to-brand-50 text-xs text-brand-700">
                {primaryMedia ? primaryMedia.storage_path : 'Sin foto'}
              </div>
              <div className="p-4">
                <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                <p className="text-xs text-gray-500">{t.tag}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-brand-700">{formatCOP(t.price_cop)}</span>
                  <Badge className="bg-gray-100 text-gray-600">{t.duration}</Badge>
                </div>
                {!t.active && <Badge className="mt-2 bg-red-100 text-red-700">Inactivo</Badge>}
              </div>
            </Card>
          );
        })}
        {(tours ?? []).length === 0 && (
          <p className="text-sm text-gray-400">
            Aún no hay tours sembrados. Corre <code>npm run seed:tours</code> dentro de <code>crm/</code>.
          </p>
        )}
      </div>
    </div>
  );
}
