import { supabaseAdmin } from '@/lib/supabase/server';
import { PageHeader, Card } from '@/components/ui';
import { CHANNEL_LABELS, CHANNEL_COLORS } from '@/lib/types';

export const dynamic = 'force-dynamic';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} h`;
  return `${(seconds / 86400).toFixed(1)} d`;
}

export default async function ReportsPage() {
  const db = supabaseAdmin();

  const [{ data: conversations }, { data: stages }, { data: deals }, { data: responseTimes }] = await Promise.all([
    db.from('conversations').select('channel'),
    db.from('pipeline_stages').select('id, name, position, is_won, is_lost').order('position'),
    db.from('deals').select('id, stage_id, value_cop'),
    db.from('response_time_seconds').select('channel, response_seconds'),
  ]);

  const leadsByChannel: Record<string, number> = {};
  for (const c of conversations ?? []) leadsByChannel[c.channel] = (leadsByChannel[c.channel] ?? 0) + 1;
  const totalLeads = conversations?.length ?? 0;

  const dealsByStage: Record<string, { count: number; value: number }> = {};
  for (const d of deals ?? []) {
    const bucket = (dealsByStage[d.stage_id] ??= { count: 0, value: 0 });
    bucket.count += 1;
    bucket.value += d.value_cop ?? 0;
  }
  const maxStageCount = Math.max(1, ...(stages ?? []).map((s) => dealsByStage[s.id]?.count ?? 0));

  const respByChannel: Record<string, number[]> = {};
  for (const r of responseTimes ?? []) {
    if (!r.channel || r.response_seconds === null) continue;
    (respByChannel[r.channel] ??= []).push(r.response_seconds);
  }
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const overallResponseTimes = (responseTimes ?? [])
    .map((r) => r.response_seconds)
    .filter((n): n is number => n !== null);

  return (
    <div>
      <PageHeader title="Reportes" description="Leads, conversión y tiempos de respuesta" />
      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-gray-900">Leads por canal</h2>
          <div className="mt-4 space-y-3">
            {Object.entries(leadsByChannel).length === 0 && (
              <p className="text-sm text-gray-400">Todavía no hay conversaciones.</p>
            )}
            {Object.entries(leadsByChannel)
              .sort((a, b) => b[1] - a[1])
              .map(([channel, count]) => (
                <div key={channel}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${CHANNEL_COLORS[channel] ?? 'bg-gray-100 text-gray-600'}`}>
                      {CHANNEL_LABELS[channel] ?? channel}
                    </span>
                    <span className="text-gray-500">
                      {count} · {totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-brand-500"
                      style={{ width: `${totalLeads > 0 ? (count / totalLeads) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold text-gray-900">Tiempo de respuesta promedio</h2>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {overallResponseTimes.length > 0 ? formatDuration(avg(overallResponseTimes)) : '—'}
          </p>
          <p className="text-xs text-gray-400">
            {overallResponseTimes.length} mensaje{overallResponseTimes.length === 1 ? '' : 's'} entrantes con respuesta registrada
          </p>
          <div className="mt-4 space-y-2">
            {Object.entries(respByChannel).map(([channel, arr]) => (
              <div key={channel} className="flex items-center justify-between text-xs">
                <span className={`rounded-full px-2 py-0.5 font-medium ${CHANNEL_COLORS[channel] ?? 'bg-gray-100 text-gray-600'}`}>
                  {CHANNEL_LABELS[channel] ?? channel}
                </span>
                <span className="text-gray-600">{formatDuration(avg(arr))}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-900">Conversión por etapa del pipeline</h2>
          <div className="mt-4 space-y-3">
            {(stages ?? []).map((s) => {
              const bucket = dealsByStage[s.id];
              return (
                <div key={s.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-700">
                      {s.name}
                      {s.is_won && ' 🎉'}
                      {s.is_lost && ' ✕'}
                    </span>
                    <span className="text-gray-500">{bucket?.count ?? 0} deals</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div
                      className={`h-2 rounded-full ${s.is_won ? 'bg-green-500' : s.is_lost ? 'bg-red-400' : 'bg-brand-500'}`}
                      style={{ width: `${((bucket?.count ?? 0) / maxStageCount) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {(stages ?? []).length === 0 && <p className="text-sm text-gray-400">Sin etapas configuradas.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
