import type { AndonState, ChildNode, Profile, TelemetryRow } from '@/lib/types';

export type DashboardHive = ChildNode & { latest: TelemetryRow | null };

export interface DashboardKpis {
  thermalCompliancePct: number | null;
  thermalDeviationMeanC: number | null;
  humidityCompliancePct: number | null;
  humidityDeviationMean: number | null;
  humidityUnit: '% HR' | '°C';
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function deviation(value: number, min: number, max: number) {
  if (value < min) return min - value;
  if (value > max) return value - max;
  return 0;
}

export function overallAndon(hives: DashboardHive[]): AndonState {
  if (!hives.length || hives.every((hive) => !hive.latest)) return 'white';
  const states = hives.map((hive) => hive.latest?.andon_state || 'white');
  if (states.includes('red')) return 'red';
  if (states.includes('yellow')) return 'yellow';
  if (states.includes('white')) return 'white';
  return 'green';
}

export function calculateKpis(hives: DashboardHive[]): DashboardKpis {
  const rows = hives.map((hive) => hive.latest).filter((row): row is TelemetryRow => Boolean(row?.is_valid));
  if (!rows.length) {
    return {
      thermalCompliancePct: null,
      thermalDeviationMeanC: null,
      humidityCompliancePct: null,
      humidityDeviationMean: null,
      humidityUnit: '% HR'
    };
  }

  const thermal = rows.filter((row) => typeof row.temperature_c === 'number');
  const thermalCompliance = thermal.filter((row) => {
    const range = row.season === 'spring_summer' ? [33, 36] : [8, 14];
    return row.temperature_c! >= range[0] && row.temperature_c! <= range[1];
  }).length;
  const thermalDeviations = thermal.map((row) => {
    const range = row.season === 'spring_summer' ? [33, 36] : [8, 14];
    return deviation(row.temperature_c!, range[0], range[1]);
  });

  const summerRows = rows.filter((row) => row.season === 'spring_summer' && typeof row.humidity_rh === 'number');
  const winterRows = rows.filter((row) => row.season === 'autumn_winter' && typeof row.dew_point_margin_c === 'number');
  const currentSeason = rows[0]?.season || 'spring_summer';

  if (currentSeason === 'autumn_winter' && winterRows.length) {
    // En otoño/invierno la tesis no fija un límite universal de HR: el indicador se basa
    // en el margen T - Trocío y su historial. Como resumen inicial mostramos el margen medio;
    // el estado Andon conserva la comparación histórica por franja.
    const ok = winterRows.filter((row) => !(
      row.andon_state === 'yellow' && row.alert_title?.toLowerCase().includes('rocío')
    )).length;
    return {
      thermalCompliancePct: thermal.length ? (thermalCompliance / thermal.length) * 100 : null,
      thermalDeviationMeanC: mean(thermalDeviations.filter((value) => value > 0)) ?? 0,
      humidityCompliancePct: winterRows.length ? (ok / winterRows.length) * 100 : null,
      humidityDeviationMean: mean(winterRows.map((row) => row.dew_point_margin_c!)),
      humidityUnit: '°C'
    };
  }

  const humidityCompliance = summerRows.filter((row) => row.humidity_rh! >= 55 && row.humidity_rh! <= 75).length;
  const humidityDeviations = summerRows.map((row) => deviation(row.humidity_rh!, 55, 75));
  return {
    thermalCompliancePct: thermal.length ? (thermalCompliance / thermal.length) * 100 : null,
    thermalDeviationMeanC: mean(thermalDeviations.filter((value) => value > 0)) ?? 0,
    humidityCompliancePct: summerRows.length ? (humidityCompliance / summerRows.length) * 100 : null,
    humidityDeviationMean: mean(humidityDeviations.filter((value) => value > 0)) ?? 0,
    humidityUnit: '% HR'
  };
}

export async function loadDashboardData(supabase: any, ownerId: string) {
  const [profileRes, apiaryRes, childrenRes, telemetryRes, alertsRes, motherRes, subscriptionRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', ownerId).maybeSingle(),
    supabase.from('apiaries').select('*').eq('owner_id', ownerId).order('created_at', { ascending: true }).limit(1).maybeSingle(),
    supabase.from('child_nodes').select('*').eq('owner_id', ownerId).eq('active', true).order('created_at', { ascending: true }),
    supabase.from('telemetry').select('*').eq('owner_id', ownerId).order('measured_at', { ascending: false }).limit(5000),
    supabase.from('alerts').select('*, child_nodes(display_name)').eq('owner_id', ownerId).order('created_at', { ascending: false }).limit(12),
    supabase.from('mother_nodes').select('id,mother_uid,last_seen_at,active').eq('owner_id', ownerId).limit(1).maybeSingle(),
    supabase.from('subscriptions').select('plan_name,status,current_period_end').eq('owner_id', ownerId).maybeSingle()
  ]);

  const firstError = [profileRes.error, apiaryRes.error, childrenRes.error, telemetryRes.error, alertsRes.error, motherRes.error, subscriptionRes.error].find(Boolean);
  if (firstError) throw firstError;

  const telemetry = (telemetryRes.data || []) as TelemetryRow[];
  const latestMap = new Map<string, TelemetryRow>();
  for (const row of telemetry) {
    if (!latestMap.has(row.child_node_id)) latestMap.set(row.child_node_id, row);
  }

  const hives = ((childrenRes.data || []) as ChildNode[]).map((child) => ({
    ...child,
    latest: latestMap.get(child.id) || null
  }));

  return {
    owner: profileRes.data as Profile | null,
    apiary: apiaryRes.data,
    mother: motherRes.data,
    subscription: subscriptionRes.data,
    hives,
    telemetry,
    alerts: alertsRes.data || [],
    status: overallAndon(hives),
    kpis: calculateKpis(hives)
  };
}
