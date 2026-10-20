import Link from 'next/link';
import { ArrowLeft, Bug, Clock3, Droplets, Gauge, Move3d, Radio, Thermometer, Waves } from 'lucide-react';
import { notFound } from 'next/navigation';
import { HiveNameForm } from '@/components/hive-name-form';
import { HiveGeometryForm } from '@/components/hive-geometry-form';
import { StatusBadge } from '@/components/status-badge';
import { TelemetryChart } from '@/components/telemetry-chart';
import { requireViewer, resolveOwnerId } from '@/lib/auth';
import { formatDateTime } from '@/lib/time';
import type { TelemetryRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

function metric(value: number | null | undefined, suffix = '', digits = 1) {
  return value == null ? '—' : `${value.toFixed(digits)}${suffix}`;
}

export default async function HiveDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ as_user?: string }> }) {
  const { id } = await params;
  const search = await searchParams;
  const { profile, supabase } = await requireViewer();
  const ownerId = await resolveOwnerId(profile, search.as_user);
  const suffix = profile.role === 'admin' && ownerId !== profile.id ? `?as_user=${ownerId}` : '';

  const { data: hive } = await supabase.from('child_nodes').select('*').eq('id', id).eq('owner_id', ownerId).maybeSingle();
  if (!hive) notFound();

  const [{ data: rows }, { data: alerts }] = await Promise.all([
    supabase.from('telemetry').select('*').eq('child_node_id', id).order('measured_at', { ascending: false }).limit(240),
    supabase.from('alerts').select('*').eq('child_node_id', id).order('created_at', { ascending: false }).limit(10)
  ]);
  const telemetry = (rows || []) as TelemetryRow[];
  const latest = telemetry[0] || null;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
      <Link href={`/dashboard${suffix}`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-white"><ArrowLeft className="h-4 w-4"/> Volver al apiario</Link>
      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div><div className="mb-2 font-mono text-xs text-slate-700">{hive.mac_address}</div><HiveNameForm id={hive.id} initialName={hive.display_name}/><div className="mt-2 text-sm text-slate-600">Última medición: {formatDateTime(latest?.measured_at)}</div></div>
        <StatusBadge state={latest?.andon_state || 'white'} />
      </div>

      {latest?.alert_message && <div className={`mt-6 rounded-2xl border p-5 ${latest.andon_state === 'red' ? 'border-red-300/15 bg-red-300/[.05]' : 'border-amber-300/15 bg-amber-300/[.05]'}`}><div className={`text-sm font-black ${latest.andon_state === 'red' ? 'text-red-300' : 'text-amber-300'}`}>{latest.alert_title}</div><div className="mt-2 text-sm leading-6 text-slate-400">{latest.alert_message}</div><div className="mt-3 text-xs text-slate-600">El sistema no emite un diagnóstico sanitario automático. La alerta indica que corresponde seguimiento o inspección.</div></div>}

      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {[
          [Thermometer, 'Temperatura', metric(latest?.temperature_c, ' °C')],
          [Droplets, 'Humedad', metric(latest?.humidity_rh, ' %', 0)],
          [Gauge, 'Punto de rocío', metric(latest?.dew_point_c, ' °C')],
          [Waves, 'Energía acústica', metric(latest?.acoustic_energy, '', 2)],
          [Waves, 'Banda 500–600 Hz', latest?.swarm_band_detected == null ? '—' : latest.swarm_band_detected ? 'Detectada' : 'No detectada'],
          [Radio, 'Actividad piquera', latest?.activity_detected == null ? '—' : latest.activity_detected ? 'Detectada' : 'Sin detección'],
          [Move3d, 'Inclinación', latest?.tilt_alert == null ? '—' : latest.tilt_alert ? 'Alerta' : latest?.tilt_delta_deg != null ? `${latest.tilt_delta_deg.toFixed(1)}° / ${latest.tilt_critical_deg?.toFixed(1) ?? '—'}°` : 'Estable'],
          [Clock3, 'Franja', latest?.time_band || '—']
        ].map(([Icon,label,display]: any) => <div key={label} className="glass rounded-2xl p-4"><Icon className="h-4 w-4 text-amber-300"/><div className="mt-4 text-xs text-slate-600">{label}</div><div className="mt-1 font-black">{display}</div></div>)}
      </div>

      <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="glass rounded-3xl p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-black">Evolución de temperatura y humedad</h2><p className="mt-1 text-xs text-slate-600">Histórico recibido desde el Nodo Madre.</p></div><div className="text-xs text-slate-600">Hasta 240 registros</div></div><div className="mt-4"><TelemetryChart data={telemetry}/></div></section>
        <aside className="space-y-4"><div className="glass rounded-3xl p-5"><div className="flex items-center gap-2"><Bug className="h-4 w-4 text-amber-300"/><h2 className="font-black">Alertas de esta colmena</h2></div><div className="mt-4 space-y-3">{(alerts || []).map((alert: any) => <div key={alert.id} className="rounded-xl border border-white/5 bg-white/[.02] p-3"><div className={`text-xs font-black ${alert.level === 'critical' ? 'text-red-300' : 'text-amber-300'}`}>{alert.title}</div><div className="mt-1 text-xs leading-5 text-slate-500">{alert.message}</div><div className="mt-2 text-[10px] text-slate-700">{formatDateTime(alert.created_at)}</div></div>)}{!(alerts || []).length && <div className="text-sm text-slate-600">Sin alertas registradas.</div>}</div></div><HiveGeometryForm hive={hive}/></aside>
      </div>

      <section className="mt-7 glass overflow-hidden rounded-3xl">
        <div className="border-b border-white/5 p-5"><h2 className="font-black">Registros recientes</h2></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="text-slate-600"><tr className="border-b border-white/5">{['Fecha','Estado','Temp.','HR','Piquera','Acústica','Inclinación','Franja','Validez'].map((h)=><th key={h} className="px-4 py-3 font-bold">{h}</th>)}</tr></thead><tbody>{telemetry.slice(0, 50).map((row)=><tr key={row.id} className="border-b border-white/[.035]"><td className="px-4 py-3 text-slate-500">{formatDateTime(row.measured_at)}</td><td className="px-4 py-3"><StatusBadge state={row.andon_state}/></td><td className="px-4 py-3 font-bold">{metric(row.temperature_c,' °C')}</td><td className="px-4 py-3 font-bold">{metric(row.humidity_rh,' %',0)}</td><td className="px-4 py-3">{row.activity_detected == null ? '—' : row.activity_detected ? 'Sí' : 'No'}</td><td className="px-4 py-3">{metric(row.acoustic_energy,'',2)}</td><td className="px-4 py-3">{row.tilt_alert ? 'Alerta' : 'Estable'}</td><td className="px-4 py-3 capitalize">{row.time_band}</td><td className="px-4 py-3">{row.is_valid ? 'Válida' : 'Descartada'}</td></tr>)}</tbody></table></div>
      </section>
    </div>
  );
}
