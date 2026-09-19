'use client';

import { useTransition } from 'react';
import { moveDealStage } from '@/lib/actions/deals';
import { Select } from '@/components/ui';

export function DealStageSelect({
  dealId,
  currentStageId,
  stages,
}: {
  dealId: string;
  currentStageId: string;
  stages: { id: string; name: string }[];
}) {
  const [, startTransition] = useTransition();

  return (
    <Select
      defaultValue={currentStageId}
      className="text-xs"
      onChange={(e) => {
        const stageId = e.target.value;
        startTransition(() => {
          moveDealStage(dealId, stageId);
        });
      }}
    >
      {stages.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </Select>
  );
}
