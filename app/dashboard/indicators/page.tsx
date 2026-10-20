import Link from 'next/link';
import { Activity, ArrowLeft, Boxes, Droplets, RadioTower, Thermometer } from 'lucide-react';
import { requireViewer, resolveOwnerId } from '@/lib/auth';
import { loadDashboardData } from '@/lib/dashboard';
import { calculateHiveSampleSize } from '@/lib/sample-size';
import { formatDateTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

function value(value: number | null, suffix = '', digits = 0) {
  return value === null || Number.isNaN(value) ? '—' : `${value.toFixed(digits)}${suffix}`;
}

export default async function IndicatorsPage({ searchParams }: { searchParams: Promise<{ as_user?: string }> }) {
  const search = await searchParams;
  const { profile, supabase } = await requireViewer();
  const ownerId = await resolveOwnerId(profile, search.as_user);
  const data = await loadDashboardData(supabase, ownerId);
  const suffix = profile.role === 'admin' && ownerId !== profile.id ? `?as_user=${ownerId}` : '';
  const totalHives = data.apiary?.total_hives as number | null | undefined;
  const sample = totalHives ? calculateHiveSampleSize(totalHives) : null;

  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
    <Link href={`/dashboard${suffix}`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-white"><ArrowLeft className="h-4 w-4"/> Volver al estado general</Link>
    <div className="mt-6"><div className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Detalle analítico</div><h1 className="mt-2 text-4xl font-black tracking-[-.04em]">KPI del apiario</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">Esta pantalla contiene los valores que deliberadamente no aparecen en la vista Andon inicial. Los KPI se calculan a partir del último registro válido disponible de cada colmena instrumentada.</p></div>
    <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[
      [Boxes,'Nodos Hijo instrumentados',String(data.hives.length),'Colmenas con nodo activo'],
      [Thermometer,'Cumplimiento térmico',value(data.kpis.thermalCompliancePct,'%'),`Desviación térmica media: ${value(data.kpis.thermalDeviationMeanC,' °C',1)}`],
      [Droplets,'Cumplimiento higrométrico',value(data.kpis.humidityCompliancePct,'%'),`${data.kpis.humidityUnit==='°C'?'Margen medio al punto de rocío':'Desviación media'}: ${value(data.kpis.humidityDeviationMean,` ${data.kpis.humidityUnit}`,1)}`],
      [Activity,'Muestra representativa',sample?String(sample.sample):'—',totalHives?`Población declarada: ${totalHives}`:'Definí la población en Configuración'],
      [RadioTower,'Último contacto Madre',formatDateTime(data.mother?.last_seen_at),data.mother?.mother_uid||'Sin Nodo Madre'],
      [Activity,'Registros cargados',String(data.telemetry.length),'Ventana de consulta del dashboard']
    ].map(([Icon,label,display,sub]:any)=><div key={label} className="glass rounded-2xl p-5"><Icon className="h-4 w-4 text-amber-300"/><div className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-600">{label}</div><div className="mt-2 text-2xl font-black">{display}</div><div className="mt-2 text-xs leading-5 text-slate-600">{sub}</div></div>)}</div>
    <div className="mt-7 rounded-2xl border border-white/5 bg-white/[.02] p-5 text-sm leading-6 text-slate-500"><span className="font-black text-slate-300">Criterio estacional:</span> en primavera-verano el control higrométrico usa 55–75 % HR; en otoño-invierno se utiliza el margen entre temperatura interna y punto de rocío comparado con el histórico de la misma franja. Las variables de piquera y acústica aportan contexto; la inclinación puede generar una alerta independiente.</div>
  </div>;
}
