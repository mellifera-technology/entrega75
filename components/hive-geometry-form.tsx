'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { calculateTiltGeometry } from '@/lib/tilt';

export function HiveGeometryForm({ hive }: { hive: any }) {
  const [standard,setStandard]=useState(Number(hive.standard_boxes ?? 1));
  const [threeQuarter,setThreeQuarter]=useState(Number(hive.three_quarter_boxes ?? 0));
  const [half,setHalf]=useState(Number(hive.half_boxes ?? 0));
  const [loading,setLoading]=useState(false); const [message,setMessage]=useState(''); const router=useRouter();
  const geometry=useMemo(()=>calculateTiltGeometry({standardBoxes:standard,threeQuarterBoxes:threeQuarter,halfBoxes:half}),[standard,threeQuarter,half]);
  async function submit(e:FormEvent){e.preventDefault(); setLoading(true);setMessage(''); const response=await fetch(`/api/hives/${hive.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({standardBoxes:standard,threeQuarterBoxes:threeQuarter,halfBoxes:half})}); const data=await response.json();setLoading(false);if(!response.ok){setMessage(data.error||'No se pudo guardar.');return;}setMessage('Geometría guardada.');router.refresh();}
  return <form onSubmit={submit} className="rounded-2xl border border-white/5 bg-white/[.02] p-4"><div className="text-sm font-black">Geometría para estabilidad</div><p className="mt-1 text-xs leading-5 text-slate-600">Indicá la cantidad de cuerpos instalados. En “estándar” incluí la cámara de cría si usa esa altura.</p><div className="mt-4 grid grid-cols-3 gap-2">{[[standard,setStandard,'Estándar','242 mm'],[threeQuarter,setThreeQuarter,'3/4','190 mm'],[half,setHalf,'Media','148 mm']].map(([v,setter,label,height]:any)=><label key={label}><span className="block text-[10px] font-bold text-slate-600">{label}</span><input type="number" min="0" max="20" value={v} onChange={(e)=>setter(Number(e.target.value)||0)} className="mt-1 w-full px-2 py-2 text-sm"/><span className="mt-1 block text-[9px] text-slate-700">{height}</span></label>)}</div><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-black/15 p-3"><div className="text-slate-600">Altura estimada</div><div className="mt-1 font-black">{geometry.heightCm.toFixed(1)} cm</div></div><div className="rounded-xl bg-black/15 p-3"><div className="text-slate-600">Ángulo crítico</div><div className="mt-1 font-black text-amber-300">{geometry.criticalDeg.toFixed(1)}°</div></div></div><button disabled={loading||geometry.heightCm<=0} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold">{loading?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Save className="h-3.5 w-3.5"/>} Guardar geometría</button>{message&&<div className="mt-2 text-xs text-slate-500">{message}</div>}</form>;
}
