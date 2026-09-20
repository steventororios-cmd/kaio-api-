'use client';

import { useState, useTransition } from 'react';
import { Card } from '@/components/ui';
import { moveDealStage } from '@/lib/actions/deals';
import { formatCOP } from '@/lib/types';

interface Deal {
  id: string;
  title: string | null;
  value_cop: number | null;
  pax: number | null;
  stage_id: string;
  contacts: { full_name: string | null } | null;
}

interface Stage {
  id: string;
  name: string;
}

export function PipelineBoard({ stages, deals }: { stages: Stage[]; deals: Deal[] }) {
  const [localDeals, setLocalDeals] = useState(deals);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const dealsByStage: Record<string, Deal[]> = {};
  for (const d of localDeals) (dealsByStage[d.stage_id] ??= []).push(d);

  function handleDrop(stageId: string) {
    setDragOverStage(null);
    if (!draggingId) return;
    const dealId = draggingId;
    setDraggingId(null);
    setLocalDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage_id: stageId } : d)));
    startTransition(() => {
      moveDealStage(dealId, stageId);
    });
  }

  return (
    <div className="flex gap-4 overflow-x-auto p-6">
      {stages.map((stage) => (
        <div
          key={stage.id}
          className="w-72 shrink-0"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverStage(stage.id);
          }}
          onDragLeave={() => setDragOverStage((s) => (s === stage.id ? null : s))}
          onDrop={() => handleDrop(stage.id)}
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">{stage.name}</h3>
            <span className="text-xs text-gray-400">{dealsByStage[stage.id]?.length ?? 0}</span>
          </div>
          <div
            className={`min-h-[60px] space-y-2 rounded-md p-1 transition-colors ${
              dragOverStage === stage.id ? 'bg-brand-50 ring-2 ring-brand-200' : ''
            }`}
          >
            {(dealsByStage[stage.id] ?? []).map((d) => (
              <Card
                key={d.id}
                draggable
                onDragStart={() => setDraggingId(d.id)}
                onDragEnd={() => setDraggingId(null)}
                className={`cursor-grab select-none p-3 active:cursor-grabbing ${
                  draggingId === d.id ? 'opacity-40' : ''
                }`}
              >
                <p className="text-sm font-medium text-gray-900">{d.contacts?.full_name || 'Sin nombre'}</p>
                {d.title && <p className="text-xs text-gray-500">{d.title}</p>}
                <p className="mt-1 text-xs text-gray-500">
                  {formatCOP(d.value_cop)} · {d.pax ?? '?'} pax
                </p>
              </Card>
            ))}
            {(dealsByStage[stage.id] ?? []).length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-gray-300">Suelta aquí</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
