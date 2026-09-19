import { supabaseAdmin } from '@/lib/supabase/server';
import { PageHeader, Card, Textarea, Button } from '@/components/ui';
import { updateAgentSettings } from '@/lib/actions/settings';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const db = supabaseAdmin();
  const { data: settings } = await db.from('agent_settings').select('*').eq('id', true).maybeSingle();

  return (
    <div>
      <PageHeader title="Configuración" description="Agente de IA y canales" />
      <div className="max-w-2xl space-y-6 p-6">
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-gray-900">Agente de ventas (IA)</h2>
          <p className="mt-1 text-xs text-gray-500">
            El motor de IA se conecta en la Fase 3. Aquí defines su personalidad y el interruptor general.
          </p>
          <form action={updateAgentSettings} className="mt-4 space-y-3">
            <Textarea
              name="system_prompt"
              defaultValue={settings?.system_prompt ?? ''}
              rows={8}
              placeholder="Instrucciones del agente…"
            />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="autonomous_enabled"
                defaultChecked={settings?.autonomous_enabled ?? true}
                className="h-4 w-4 rounded border-gray-300"
              />
              IA activa globalmente (apágalo para pausar respuestas automáticas en todas las conversaciones)
            </label>
            <Button type="submit">Guardar</Button>
          </form>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold text-gray-900">Canales</h2>
          <p className="mt-1 text-xs text-gray-500">
            WhatsApp, Instagram y Messenger se conectan en la Fase 2 con las credenciales de tu Meta App (ver{' '}
            <code>crm/.env.example</code>). Por ahora el inbox funciona en modo manual/interno.
          </p>
        </Card>
      </div>
    </div>
  );
}
