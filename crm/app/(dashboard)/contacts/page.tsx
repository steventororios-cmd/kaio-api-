import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/server';
import { PageHeader, Card, Input, Button } from '@/components/ui';
import { createContact } from '@/lib/actions/contacts';

export const dynamic = 'force-dynamic';

export default async function ContactsPage() {
  const db = supabaseAdmin();
  const { data: contacts } = await db
    .from('contacts')
    .select('id, full_name, phone, email, city, created_at')
    .order('created_at', { ascending: false });

  return (
    <div>
      <PageHeader title="Contactos" description="Todos los leads y clientes" />
      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                  <th className="px-4 py-2">Nombre</th>
                  <th className="px-4 py-2">Teléfono</th>
                  <th className="px-4 py-2">Ciudad</th>
                </tr>
              </thead>
              <tbody>
                {(contacts ?? []).map((c) => (
                  <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <Link href={`/contacts/${c.id}`} className="font-medium text-brand-700 hover:underline">
                        {c.full_name || 'Sin nombre'}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{c.phone || '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{c.city || '—'}</td>
                  </tr>
                ))}
                {(contacts ?? []).length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                      Todavía no hay contactos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>

        <Card className="h-fit p-4">
          <h2 className="text-sm font-semibold text-gray-900">Nuevo contacto</h2>
          <form action={createContact} className="mt-3 space-y-3">
            <Input name="full_name" placeholder="Nombre completo" required />
            <Input name="phone" placeholder="Teléfono / WhatsApp" />
            <Input name="email" placeholder="Email" type="email" />
            <Input name="city" placeholder="Ciudad" />
            <Button type="submit" className="w-full">
              Crear contacto
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
