'use client';

import { useTransition } from 'react';
import { toggleTask } from '@/lib/actions/tasks';

export function TaskCheckbox({ taskId, done }: { taskId: string; done: boolean }) {
  const [, startTransition] = useTransition();

  return (
    <input
      type="checkbox"
      defaultChecked={done}
      className="mt-1 h-4 w-4 rounded border-gray-300"
      onChange={(e) => {
        const checked = e.currentTarget.checked;
        startTransition(() => {
          toggleTask(taskId, checked);
        });
      }}
    />
  );
}
