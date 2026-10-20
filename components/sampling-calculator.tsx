"use client";

import { useMemo, useState } from 'react';
import { calculateHiveSampleSize } from '@/lib/sample-size';

export function SamplingCalculator({ initialPopulation = 20, compact = false }: { initialPopulation?: number; compact?: boolean }) {
  const [population, setPopulation] = useState(initialPopulation);
  const result = useMemo(() => calculateHiveSampleSize(population), [population]);

  return (
    <div className={compact ? '' : 'glass rounded-3xl p-6 md:p-8'}>
      <div className="flex flex-col gap-6 md:flex-row md:items-end">
        <label className="flex-1">
          <span className="mb-2 block text-sm font-semibold text-slate-200">Cantidad total de colmenas</span>
          <input
            type="number"
            min={1}
            max={5000}
            value={population}
            onChange={(e) => setPopulation(Math.max(1, Number(e.target.value) || 1))}
            className="w-full px-4 py-3 text-lg"
          />
        </label>
        <div className="min-w-52 rounded-2xl border border-amber-300/20 bg-amber-300/5 px-5 py-4">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">Nodos Hijo sugeridos</div>
          <div className="mt-1 text-4xl font-black text-white">{result.sample}</div>
          <div className="mt-1 text-xs text-slate-400">{result.coveragePercent}% del apiario instrumentado</div>
        </div>
      </div>
      <div className="mt-5 grid gap-3 text-sm text-slate-400 sm:grid-cols-3">
        <div><span className="text-slate-200">Confianza:</span> 95%</div>
        <div><span className="text-slate-200">Error máximo:</span> 1 °C</div>
        <div><span className="text-slate-200">S inicial:</span> 1,8 °C</div>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">
        Cálculo preliminar según el criterio estadístico definido en la tesis. Cuando existan datos reales del apiario, la dispersión observada puede reemplazar el supuesto inicial.
      </p>
    </div>
  );
}
