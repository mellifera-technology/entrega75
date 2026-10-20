'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AccountingWeight({ initial }: { initial:number }) {
  const [value,setValue]=useState(Math.round(initial*100)); const [saving,setSaving]=useState(false); const router=useRouter();
  async function save(next:number){setValue(next);setSaving(true);await fetch('/api/admin/accounting/weight',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({weighting:next/100})});setSaving(false);router.refresh();}
  return <div className="rounded-2xl border border-white/5 bg-white/[.02] p-4"><div className="flex items-center justify-between gap-4"><div><div className="text-sm font-black">Peso de proporcionalidad</div><div className="mt-1 text-xs leading-5 text-slate-600">{100-value}% se reparte 50/50 y {value}% según el capital/gastos todavía no reintegrados.</div></div><div className="text-2xl font-black text-amber-300">{value}%</div></div><input className="mt-4 w-full accent-amber-300" type="range" min="0" max="100" step="5" value={value} onChange={(e)=>save(Number(e.target.value))}/><div className="mt-2 text-[10px] text-slate-700">{saving?'Guardando…':'0% = totalmente igualitario · 100% = totalmente proporcional'}</div></div>;
}
