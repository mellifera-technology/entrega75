import Link from 'next/link';
import { Activity, AlertTriangle, Antenna, ArrowRight, Boxes, ChartNoAxesCombined, Droplets, Move3d, RadioTower, Thermometer, Waves } from 'lucide-react';
import { StatusBadge } from '@/components/status-badge';
import { requireViewer, resolveOwnerId } from '@/lib/auth';
import { loadDashboardData } from '@/lib/dashboard';
import type { AndonState, TelemetryRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

function worst(states: AndonState[]): AndonState {
  if (!states.length) return 'white';
  if (states.includes('red')) return 'red';
  if (states.includes('yellow')) return 'yellow';
  if (states.includes('white')) return 'white';
  return 'green';
}

function thermalState(rows: TelemetryRow[]): AndonState {
  return worst(rows.map((row) => {
    if (!row.is_valid || row.temperature_c == null) return 'white';
    const [min,max] = row.season === 'spring_summer' ? [33,36] : [8,14];
    if (row.temperature_c < min || row.temperature_c > max) return 'red';
    if ((row.alert_title || '').toLowerCase().includes('térmic')) return 'yellow';
    return 'green';
  }));
}

function humidityState(rows: TelemetryRow[]): AndonState {
  return worst(rows.map((row) => {
    if (!row.is_valid || row.humidity_rh == null) return 'white';
    if (row.season === 'spring_summer' && (row.humidity_rh < 55 || row.humidity_rh > 75)) return 'red';
    const title = (row.alert_title || '').toLowerCase();
    if (title.includes('higrom') || title.includes('rocío')) return 'yellow';
    return 'green';
  }));
}

function communicationState(lastSeen?: string | null): AndonState {
  if (!lastSeen) return 'white';
  const hours = (Date.now() - new Date(lastSeen).getTime()) / 3600000;
  if (hours > 24) return 'red';
  if (hours > 7) return 'yellow';
  return 'green';
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ as_user?: string }> }) {
  const params = await searchParams;
  const { profile, supabase } = await requireViewer();
  const ownerId = await resolveOwnerId(profile, params.as_user);
  const data = await loadDashboardData(supabase, ownerId);
  if (!data.owner) return <div className="p-8">Usuario no encontrado.</div>;

  const suffix = profile.role === 'admin' && ownerId !== profile.id ? `?as_user=${ownerId}` : '';
  const latestRows = data.hives.map((h) => h.latest).filter((r): r is TelemetryRow => Boolean(r));
  const structure = worst(latestRows.map((row) => !row.is_valid ? 'white' : row.tilt_alert ? 'red' : 'green'));
  const contextual = worst(latestRows.map((row) => {
    const title = (row.alert_title || '').toLowerCase();
    if (title.includes('actividad') || title.includes('acúst') || title.includes('500–600')) return 'yellow';
    return row.is_valid ? 'green' : 'white';
  }));

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
      {profile.role === 'admin' && ownerId !== profile.id && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/[.05] p-4 text-sm">
          <div><span className="font-black text-amber-300">Vista administrativa:</span> estás viendo el panel de {data.owner.full_name}.</div>
          <Link href="/admin" className="font-bold text-amber-300">Volver al admin</Link>
        </div>
      )}

      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[.18em] text-slate-600">{data.apiary?.name || 'Apiario principal'}</div>
          <h1 className="mt-2 text-3xl font-black tracking-[-.04em] sm:text-4xl">Estado general del apiario</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">La vista inicial prioriza estados visuales. Los valores numéricos, KPI e históricos quedan disponibles al entrar al detalle.</p>
        </div>
        <StatusBadge state={data.status} />
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          [Thermometer,'Estado térmico',thermalState(latestRows)],
          [Droplets,'Estado higrométrico',humidityState(latestRows)],
          [Move3d,'Estabilidad estructural',structure],
          [Waves,'Variables contextuales',contextual],
          [Antenna,'Comunicación',communicationState(data.mother?.last_seen_at)]
        ].map(([Icon,label,state]: any)=><div key={label} className="glass rounded-2xl p-5"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-slate-600">{label}</span><Icon className="h-4 w-4 text-amber-300"/></div><div className="mt-5"><StatusBadge state={state}/></div></div>)}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={`/dashboard/indicators${suffix}`} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-[#0b1014]"><ChartNoAxesCombined className="h-4 w-4"/> Ver KPI y valores del apiario</Link>
        <Link href={`/dashboard/settings${suffix}`} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-300"><Activity className="h-4 w-4"/> Configurar apiario y muestreo</Link>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_380px]">
        <section id="colmenas" className="glass rounded-3xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-black">Colmenas instrumentadas</h2><p className="mt-1 text-sm text-slate-600">El color permite priorizar sin interpretar números en la pantalla inicial.</p></div><div className="hidden items-center gap-2 text-xs text-slate-600 sm:flex"><Boxes className="h-4 w-4"/> Nodos Hijo vinculados</div></div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {data.hives.map((hive) => {
              const row = hive.latest;
              const href = `/dashboard/hives/${hive.id}${suffix}`;
              return (
                <Link key={hive.id} href={href} className="group rounded-2xl border border-white/5 bg-[#0a1015] p-5 transition hover:border-amber-300/20 hover:bg-white/[.025]">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-lg font-black">{hive.display_name}</div><div className="mt-1 truncate font-mono text-[10px] text-slate-700">{hive.mac_address}</div></div><StatusBadge state={row?.andon_state || 'white'} /></div>
                  {row?.alert_title ? <div className="mt-5 rounded-xl bg-white/[.025] p-3 text-xs leading-5 text-slate-500"><span className="font-bold text-slate-300">{row.alert_title}.</span> {row.andon_state === 'red' ? 'Requiere inspección.' : 'Requiere seguimiento.'}</div> : <div className="mt-5 rounded-xl bg-emerald-300/[.035] p-3 text-xs text-slate-500">Sin condiciones prioritarias detectadas en el último registro.</div>}
                  <div className="mt-4 flex items-center justify-between text-xs font-bold text-slate-600 group-hover:text-amber-300"><span>Ver variables e histórico</span><ArrowRight className="h-3.5 w-3.5"/></div>
                </Link>
              );
            })}
            {!data.hives.length && <div className="col-span-full rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-600">Todavía no llegó ningún MAC de Nodo Hijo. El primer paquete válido lo crea automáticamente.</div>}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="glass rounded-3xl p-5">
            <div className="flex items-center justify-between"><h2 className="font-black">Atención prioritaria</h2><AlertTriangle className="h-4 w-4 text-amber-300"/></div>
            <div className="mt-4 space-y-3">
              {data.alerts.slice(0, 5).map((alert: any) => (
                <Link key={alert.id} href={`/dashboard/hives/${alert.child_node_id}${suffix}`} className="block rounded-xl border border-white/5 bg-white/[.02] p-3">
                  <div className={`text-xs font-black ${alert.level === 'critical' ? 'text-red-300' : 'text-amber-300'}`}>{alert.level === 'critical' ? 'INSPECCIÓN' : 'SEGUIMIENTO'}</div>
                  <div className="mt-2 text-sm font-bold">{alert.child_nodes?.display_name || 'Colmena'}</div><div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{alert.message}</div>
                </Link>
              ))}
              {!data.alerts.length && <div className="rounded-xl bg-emerald-300/[.04] p-4 text-sm text-slate-500">No hay alertas registradas.</div>}
            </div>
            <Link href={`/dashboard/alerts${suffix}`} className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-white/5 px-3 py-2.5 text-xs font-bold text-slate-400 hover:text-white">Ver historial de alertas <ArrowRight className="h-3.5 w-3.5"/></Link>
          </div>
          <div className="rounded-3xl border border-white/5 bg-[#0a1015] p-5 text-sm leading-6 text-slate-500">
            <div className="flex items-center gap-2 font-black text-slate-300"><RadioTower className="h-4 w-4 text-amber-300"/> Criterio de uso</div>
            <p className="mt-2">MELLIFERA identifica condiciones que justifican seguimiento o inspección. No presenta diagnósticos sanitarios automáticos.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
