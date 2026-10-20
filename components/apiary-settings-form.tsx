'use client';

import { FormEvent, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function ApiarySettingsForm({ apiary, ownerId }: { apiary: any; ownerId: string }) {
  const [name, setName] = useState(apiary?.name || 'Apiario principal');
  const [location, setLocation] = useState(apiary?.location_text || '');
  const [totalHives, setTotalHives] = useState(apiary?.total_hives ? String(apiary.total_hives) : '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  async function submit(e: FormEvent) {
    e.preventDefault(); setLoading(true); setMessage('');
    const response = await fetch('/api/apiary', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ ownerId, name, locationText: location, totalHives: totalHives ? Number(totalHives) : null }) });
    const data = await response.json(); setLoading(false);
    if (!response.ok) { setMessage(data.error || 'No se pudo guardar.'); return; }
    setMessage('Configuración guardada.'); router.refresh();
  }

  return <form onSubmit={submit} className="glass max-w-2xl rounded-3xl p-6"><div className="space-y-5"><label className="block"><span className="mb-2 block text-sm font-bold text-slate-400">Nombre del apiario</span><input value={name} onChange={(e)=>setName(e.target.value)} className="w-full px-4 py-3" maxLength={100}/></label><label className="block"><span className="mb-2 block text-sm font-bold text-slate-400">Ubicación / referencia</span><input value={location} onChange={(e)=>setLocation(e.target.value)} className="w-full px-4 py-3" placeholder="Ej. Lobos, Buenos Aires" maxLength={180}/></label><label className="block"><span className="mb-2 block text-sm font-bold text-slate-400">Cantidad total de colmenas del apiario</span><input type="number" min="1" max="100000" value={totalHives} onChange={(e)=>setTotalHives(e.target.value)} className="w-full px-4 py-3" placeholder="Ej. 80"/><span className="mt-2 block text-xs leading-5 text-slate-600">Se usa para calcular cuántos Nodos Hijo forman la muestra representativa preliminar del proyecto. No obliga a instrumentar todas las colmenas.</span></label></div><button disabled={loading} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-3 font-black text-[#151109]">{loading?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>} Guardar</button>{message && <span className="ml-3 text-sm text-slate-400">{message}</span>}</form>;
}
