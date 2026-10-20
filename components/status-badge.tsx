import clsx from 'clsx';
import type { AndonState } from '@/lib/types';

const labels: Record<AndonState, string> = {
  green: 'Normal',
  yellow: 'Seguimiento',
  red: 'Inspección',
  white: 'Sin datos'
};

export function StatusBadge({ state, label }: { state: AndonState; label?: string }) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold',
      state === 'green' && 'border-emerald-300/20 bg-emerald-300/10 text-emerald-300',
      state === 'yellow' && 'border-amber-300/20 bg-amber-300/10 text-amber-300',
      state === 'red' && 'border-red-300/20 bg-red-300/10 text-red-300',
      state === 'white' && 'border-slate-300/20 bg-slate-300/10 text-slate-300'
    )}>
      <span className={clsx(
        'h-2 w-2 rounded-full',
        state === 'green' && 'bg-emerald-300',
        state === 'yellow' && 'bg-amber-300',
        state === 'red' && 'bg-red-300',
        state === 'white' && 'bg-slate-300'
      )} />
      {label || labels[state]}
    </span>
  );
}
