import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { AlertAckButton } from '@/components/alert-ack-button';
import { requireViewer, resolveOwnerId } from '@/lib/auth';
import { formatDateTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ as_user?: string }> }) {
  const search = await searchParams;
  const { profile, supabase } = await requireViewer();
  const ownerId = await resolveOwnerId(profile, search.as_user);
  const suffix = profile.role === 'admin' && ownerId !== profile.id ? `?as_user=${ownerId}` : '';
  const { data: alerts, error } = await supabase.from('alerts').select('*, child_nodes(display_name,mac_address)').eq('owner_id', ownerId).order('created_at', { ascending: false }).limit(250);
  if (error) throw error;

  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
    <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-300/10"><AlertTriangle className="h-5 w-5 text-amber-300"/></div><div><h1 className="text-3xl font-black tracking-[-.04em]">Alertas y seguimiento</h1><p className="mt-1 text-sm text-slate-600">Historial de condiciones detectadas por la plataforma.</p></div></div>
    <div className="mt-7 space-y-3">{(alerts || []).map((alert: any)=><div key={alert.id} className={`glass rounded-2xl p-5 ${alert.acknowledged_at ? 'opacity-60' : ''}`}><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`text-xs font-black uppercase tracking-wide ${alert.level === 'critical' ? 'text-red-300' : 'text-amber-300'}`}>{alert.level === 'critical' ? 'Inspección' : 'Seguimiento'}</span><span className="text-xs text-slate-700">{formatDateTime(alert.created_at)}</span></div><h2 className="mt-2 font-black">{alert.child_nodes?.display_name || 'Colmena'} · {alert.title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{alert.message}</p><div className="mt-2 font-mono text-[10px] text-slate-700">{alert.child_nodes?.mac_address}</div></div><div className="flex flex-wrap items-center gap-2"><AlertAckButton id={alert.id} acknowledged={Boolean(alert.acknowledged_at)}/><Link href={`/dashboard/hives/${alert.child_node_id}${suffix}`} className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-bold text-slate-300">Ver colmena <ArrowRight className="h-3 w-3"/></Link></div></div></div>)}{!(alerts || []).length && <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center text-slate-600">Todavía no hay alertas.</div>}</div>
  </div>;
}
