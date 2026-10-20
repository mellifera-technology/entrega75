import { Banknote, Calculator, HandCoins, ReceiptText, Scale } from 'lucide-react';
import { AccountingEntryForm } from '@/components/accounting-entry-form';
import { AccountingWeight } from '@/components/accounting-weight';
import { requireAdmin } from '@/lib/auth';
import { buildPartnerBalances } from '@/lib/accounting-data';
import { calculatePartnerShares } from '@/lib/accounting';

export const dynamic = 'force-dynamic';

const money = new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', maximumFractionDigits:2 });
const typeLabel: Record<string,string> = { contribution:'Aporte', expense:'Gasto', reimbursement:'Reintegro', income:'Ingreso' };

export default async function AccountingPage() {
  const { supabase } = await requireAdmin();
  const [partnersRes, entriesRes, allocationsRes, settingRes] = await Promise.all([
    supabase.from('accounting_partners').select('*').eq('active',true).order('code'),
    supabase.from('accounting_entries').select('*, accounting_partners(display_name)').order('entry_date',{ascending:false}).order('created_at',{ascending:false}).limit(500),
    supabase.from('income_allocations').select('*, accounting_partners(display_name), accounting_entries(description,entry_date,amount)').order('id',{ascending:false}).limit(500),
    supabase.from('app_settings').select('value').eq('key','accounting_income_weight').maybeSingle()
  ]);
  const error=[partnersRes.error,entriesRes.error,allocationsRes.error,settingRes.error].find(Boolean); if(error) throw error;
  const partners=partnersRes.data||[]; const entries=entriesRes.data||[]; const allocations=allocationsRes.data||[]; const weighting=Number(settingRes.data?.value??0.5);
  const balances=buildPartnerBalances(partners,entries); const shares=calculatePartnerShares(balances,weighting);
  const totalExpenses=entries.filter((e:any)=>e.entry_type==='expense').reduce((s:number,e:any)=>s+Number(e.amount),0);
  const totalIncome=entries.filter((e:any)=>e.entry_type==='income').reduce((s:number,e:any)=>s+Number(e.amount),0);
  const totalContributions=entries.filter((e:any)=>e.entry_type==='contribution').reduce((s:number,e:any)=>s+Number(e.amount),0);
  const allocatedByPartner=new Map<string,number>(); allocations.forEach((a:any)=>allocatedByPartner.set(a.partner_id,(allocatedByPartner.get(a.partner_id)||0)+Number(a.allocated_amount)));

  return <main className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
    <div><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-amber-300"><Calculator className="h-4 w-4"/> Contabilidad interna</div><h1 className="mt-2 text-4xl font-black tracking-[-.04em]">Chiara + Lucas</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">Registra aportes, gastos pagados por cada socio, reintegros e ingresos. Cada ingreso se distribuye automáticamente con una mezcla entre reparto igualitario y proporcional al dinero pendiente de recuperar.</p></div>

    <div className="mt-7 grid gap-3 sm:grid-cols-3">{[[ReceiptText,'Gastos registrados',totalExpenses],[Banknote,'Ingresos registrados',totalIncome],[HandCoins,'Aportes directos',totalContributions]].map(([Icon,label,val]:any)=><div key={label} className="glass rounded-2xl p-5"><Icon className="h-4 w-4 text-amber-300"/><div className="mt-4 text-2xl font-black">{money.format(val)}</div><div className="mt-1 text-xs text-slate-600">{label}</div></div>)}</div>

    <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_430px]">
      <div className="space-y-6">
        <AccountingEntryForm partners={partners}/>
        <section className="glass overflow-hidden rounded-3xl"><div className="border-b border-white/5 p-5"><h2 className="font-black">Movimientos</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-xs"><thead><tr className="border-b border-white/5 text-slate-600">{['Fecha','Tipo','Persona','Descripción','Importe'].map(h=><th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody>{entries.map((entry:any)=><tr key={entry.id} className="border-b border-white/[.035]"><td className="px-4 py-3 text-slate-500">{new Intl.DateTimeFormat('es-AR').format(new Date(`${entry.entry_date}T12:00:00`))}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 font-black ${entry.entry_type==='income'?'bg-emerald-300/10 text-emerald-300':entry.entry_type==='reimbursement'?'bg-sky-300/10 text-sky-300':'bg-white/5 text-slate-400'}`}>{typeLabel[entry.entry_type]}</span></td><td className="px-4 py-3 font-bold">{entry.accounting_partners?.display_name||'—'}</td><td className="px-4 py-3 text-slate-400">{entry.description}</td><td className="px-4 py-3 font-black">{money.format(Number(entry.amount))}</td></tr>)}{!entries.length&&<tr><td colSpan={5} className="p-10 text-center text-slate-600">Todavía no hay movimientos.</td></tr>}</tbody></table></div></section>
      </div>

      <aside className="space-y-6">
        <div className="glass rounded-3xl p-5 sm:p-6"><div className="flex items-center gap-2"><Scale className="h-4 w-4 text-amber-300"/><h2 className="font-black">Distribución del próximo ingreso</h2></div><div className="mt-5 space-y-3">{shares.map((share)=><div key={share.id} className="rounded-2xl border border-white/5 bg-white/[.02] p-4"><div className="flex items-center justify-between"><div><div className="font-black">{share.display_name}</div><div className="mt-1 text-xs text-slate-600">Pendiente aportado/pagado: {money.format(share.balance)}</div></div><div className="text-2xl font-black text-amber-300">{(share.share*100).toFixed(1)}%</div></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-amber-300" style={{width:`${share.share*100}%`}}/></div><div className="mt-3 text-xs text-slate-600">Ingresos asignados históricamente: {money.format(allocatedByPartner.get(share.id)||0)}</div></div>)}</div><div className="mt-4 rounded-xl border border-amber-300/10 bg-amber-300/[.04] p-3 text-xs leading-5 text-slate-500">Con la regla inicial de 50%: si Chiara tiene $100 pendientes y Lucas $0, el siguiente ingreso se distribuye 75% para Chiara y 25% para Lucas. Si ambos aportaron lo mismo, queda 50/50.</div></div>
        <AccountingWeight initial={weighting}/>
      </aside>
    </div>
  </main>;
}
