'use client';

import { FormEvent, useState } from 'react';
import { Check, Clipboard, Loader2, PackagePlus } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function CreateOrderCard() {
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<any>(null);
  const [copied, setCopied] = useState('');
  const router = useRouter();

  async function submit(e: FormEvent) {
    e.preventDefault(); setLoading(true); setError(''); setCreated(null);
    const response = await fetch('/api/admin/orders', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({code: code || undefined, customerNote: note || undefined}) });
    const data = await response.json(); setLoading(false);
    if (!response.ok) { setError(data.error || 'No se pudo crear.'); return; }
    setCreated(data); setCode(''); setNote(''); router.refresh();
  }

  async function copy(label: string, value: string) { await navigator.clipboard.writeText(value); setCopied(label); setTimeout(()=>setCopied(''),1200); }

  return <div className="glass rounded-3xl p-5 sm:p-6"><div className="flex items-center gap-2"><PackagePlus className="h-5 w-5 text-amber-300"/><h2 className="font-black">Crear pedido + Nodo Madre</h2></div><p className="mt-2 text-xs leading-5 text-slate-600">Genera el código que habilita una única cuenta y las credenciales del dispositivo. La API KEY se muestra una sola vez.</p><form onSubmit={submit} className="mt-5 space-y-3"><input value={code} onChange={(e)=>setCode(e.target.value.toUpperCase())} className="w-full px-3 py-2.5 text-sm" placeholder="Código personalizado (opcional)"/><input value={note} onChange={(e)=>setNote(e.target.value)} className="w-full px-3 py-2.5 text-sm" placeholder="Nota / cliente (opcional)"/><button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-black text-[#151109]">{loading?<Loader2 className="h-4 w-4 animate-spin"/>:<PackagePlus className="h-4 w-4"/>} Crear pedido</button></form>{error&&<div className="mt-3 text-xs text-red-300">{error}</div>}{created&&<div className="mt-5 rounded-2xl border border-emerald-300/15 bg-emerald-300/[.04] p-4"><div className="text-xs font-black text-emerald-300">CREADO CORRECTAMENTE</div>{[['PEDIDO',created.order.code],['MOTHER_UID',created.device.MOTHER_UID],['API_KEY',created.device.API_KEY]].map(([label,val])=><div key={label} className="mt-3"><div className="text-[10px] font-black text-slate-600">{label}</div><div className="mt-1 flex items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-lg bg-black/20 p-2 text-xs text-slate-300">{val}</code><button onClick={()=>copy(label,val)} className="grid h-9 w-9 flex-none place-items-center rounded-lg border border-white/5">{copied===label?<Check className="h-3.5 w-3.5 text-emerald-300"/>:<Clipboard className="h-3.5 w-3.5"/>}</button></div></div>)}</div>}</div>;
}
