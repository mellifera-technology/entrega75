'use client';

import { FormEvent, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

const labels: Record<string,string> = { contribution:'Aporte de socio', expense:'Gasto pagado por socio', reimbursement:'Reintegro al socio', income:'Ingreso de la empresa' };

export function AccountingEntryForm({ partners }: { partners: any[] }) {
  const [type,setType]=useState('expense');
  const [partner,setPartner]=useState(partners[0]?.id || '');
  const [amount,setAmount]=useState('');
  const [description,setDescription]=useState('');
  const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState('');
  const router=useRouter();
  async function submit(e:FormEvent){e.preventDefault(); setLoading(true); setMessage(''); const response=await fetch('/api/admin/accounting/entries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({entryType:type,partnerId:type==='income'?null:partner,amount:Number(amount),description,entryDate:date})}); const data=await response.json(); setLoading(false); if(!response.ok){setMessage(data.error||'Error');return;} setAmount('');setDescription('');setMessage(type==='income'?'Ingreso registrado y distribuido automáticamente.':'Movimiento registrado.');router.refresh();}
  return <form onSubmit={submit} className="glass rounded-3xl p-5 sm:p-6"><h2 className="font-black">Nuevo movimiento</h2><div className="mt-5 grid gap-3 sm:grid-cols-2"><label><span className="mb-1.5 block text-xs font-bold text-slate-500">Tipo</span><select value={type} onChange={(e)=>setType(e.target.value)} className="w-full px-3 py-2.5">{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label><span className="mb-1.5 block text-xs font-bold text-slate-500">{type==='income'?'Distribución':'Persona'}</span>{type==='income'?<div className="rounded-xl border border-white/5 bg-white/[.02] px-3 py-2.5 text-sm text-slate-500">Automática según regla actual</div>:<select value={partner} onChange={(e)=>setPartner(e.target.value)} className="w-full px-3 py-2.5">{partners.map(p=><option key={p.id} value={p.id}>{p.display_name}</option>)}</select>}</label><label><span className="mb-1.5 block text-xs font-bold text-slate-500">Importe</span><input required type="number" min="0.01" step="0.01" value={amount} onChange={(e)=>setAmount(e.target.value)} className="w-full px-3 py-2.5" placeholder="0,00"/></label><label><span className="mb-1.5 block text-xs font-bold text-slate-500">Fecha</span><input required type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="w-full px-3 py-2.5"/></label></div><label className="mt-3 block"><span className="mb-1.5 block text-xs font-bold text-slate-500">Descripción</span><input required value={description} onChange={(e)=>setDescription(e.target.value)} className="w-full px-3 py-2.5" placeholder="Ej. Compra de ESP32 / Venta kit..."/></label><button disabled={loading} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-black text-[#151109]">{loading?<Loader2 className="h-4 w-4 animate-spin"/>:<Plus className="h-4 w-4"/>} Registrar</button>{message&&<span className="ml-3 text-xs text-slate-500">{message}</span>}</form>;
}
