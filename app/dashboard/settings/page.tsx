import { Settings } from 'lucide-react';
import { ApiarySettingsForm } from '@/components/apiary-settings-form';
import { requireViewer, resolveOwnerId } from '@/lib/auth';
import { calculateHiveSampleSize } from '@/lib/sample-size';

export const dynamic = 'force-dynamic';

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ as_user?: string }> }) {
  const search = await searchParams;
  const { profile, supabase } = await requireViewer();
  const ownerId = await resolveOwnerId(profile, search.as_user);
  const { data: apiary } = await supabase.from('apiaries').select('*').eq('owner_id', ownerId).order('created_at',{ascending:true}).limit(1).maybeSingle();
  const sample = apiary?.total_hives ? calculateHiveSampleSize(apiary.total_hives) : null;
  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/5"><Settings className="h-5 w-5 text-amber-300"/></div><div><h1 className="text-3xl font-black tracking-[-.04em]">Configuración del apiario</h1><p className="mt-1 text-sm text-slate-600">Datos operativos usados por la plataforma.</p></div></div><div className="mt-7 grid gap-6 lg:grid-cols-[1fr_330px]"><ApiarySettingsForm apiary={apiary} ownerId={ownerId}/><aside className="glass rounded-3xl p-6"><div className="text-xs font-black uppercase tracking-[.18em] text-amber-300">Muestreo</div><div className="mt-4 text-5xl font-black">{sample?.sample ?? '—'}</div><div className="mt-2 text-sm leading-6 text-slate-500">{sample ? `Nodos Hijo recomendados como mínimo para ${apiary.total_hives} colmenas, con el criterio preliminar del proyecto.` : 'Ingresá la cantidad total de colmenas para obtener el cálculo.'}</div>{sample && <div className="mt-5 rounded-xl bg-white/[.025] p-3 text-xs leading-5 text-slate-600">95% de confianza · error máximo 1 °C · S inicial 1,8 °C · redondeo hacia arriba.</div>}</aside></div></div>;
}
