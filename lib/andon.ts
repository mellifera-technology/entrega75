import type { AndonState, Season, TimeBand } from '@/lib/types';

export interface SensorSnapshot {
  temperature: number | null;
  humidity: number | null;
  activity: boolean | null;
  acousticEnergy: number | null;
  swarmBandDetected?: boolean | null;
  tilt: boolean | null;
  season: Season;
  timeBand: TimeBand;
  valid?: boolean;
}

export interface HistoricalSnapshot {
  temperature_c: number | null;
  humidity_rh: number | null;
  acoustic_energy: number | null;
  dew_point_margin_c: number | null;
}

export interface AndonResult {
  state: AndonState;
  title: string | null;
  message: string | null;
  dewPointC: number | null;
  dewPointMarginC: number | null;
  temperatureDeviationC: number;
  humidityDeviationRh: number;
}

function mean(values: number[]) {
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function stdDev(values: number[]) {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((acc, value) => acc + (value - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function isStatisticallyUnusual(value: number | null, values: number[], direction: 'both' | 'low' = 'both') {
  if (value === null || values.length < 8) return false;
  const m = mean(values);
  const sd = stdDev(values);
  if (sd < 0.0001) return false;
  const z = (value - m) / sd;
  return direction === 'low' ? z < -2 : Math.abs(z) > 2.5;
}

export function dewPointMagnus(tempC: number | null, humidityRh: number | null) {
  if (tempC === null || humidityRh === null || humidityRh <= 0) return null;
  const a = 17.625;
  const b = 243.04;
  const gamma = Math.log(humidityRh / 100) + (a * tempC) / (b + tempC);
  return (b * gamma) / (a - gamma);
}

function deviationFromRange(value: number | null, min: number, max: number) {
  if (value === null) return 0;
  if (value < min) return min - value;
  if (value > max) return value - max;
  return 0;
}

export function evaluateAndon(snapshot: SensorSnapshot, history: HistoricalSnapshot[] = []): AndonResult {
  const { temperature, humidity, acousticEnergy, activity, swarmBandDetected, tilt, season, timeBand } = snapshot;
  const dewPointC = dewPointMagnus(temperature, humidity);
  const dewPointMarginC = temperature !== null && dewPointC !== null ? temperature - dewPointC : null;

  if (snapshot.valid === false || temperature === null || humidity === null) {
    return {
      state: 'white',
      title: 'Datos insuficientes',
      message: 'No hay información válida suficiente para interpretar esta colmena.',
      dewPointC,
      dewPointMarginC,
      temperatureDeviationC: 0,
      humidityDeviationRh: 0
    };
  }

  // La estabilidad estructural es la única variable secundaria con alerta independiente.
  if (tilt) {
    return {
      state: 'red',
      title: 'Inclinación de la colmena',
      message: 'La variación angular alcanzó o superó el criterio mecánico de estabilidad configurado. Requiere inspección estructural en campo.',
      dewPointC,
      dewPointMarginC,
      temperatureDeviationC: 0,
      humidityDeviationRh: 0
    };
  }

  const tempRange = season === 'spring_summer' ? [33, 36] as const : [8, 14] as const;
  const temperatureDeviationC = deviationFromRange(temperature, tempRange[0], tempRange[1]);
  const humidityDeviationRh = season === 'spring_summer' ? deviationFromRange(humidity, 55, 75) : 0;

  if (season === 'spring_summer' && temperature < 33 && humidity > 75) {
    return {
      state: 'red',
      title: 'Patrón térmico-higrométrico crítico',
      message: 'Temperatura baja y humedad alta: patrón asociado en la bibliografía a condiciones favorables para cría yesificada. No es un diagnóstico; requiere inspección urgente.',
      dewPointC,
      dewPointMarginC,
      temperatureDeviationC,
      humidityDeviationRh
    };
  }

  if (temperatureDeviationC > 0) {
    return {
      state: 'red',
      title: 'Alerta térmica',
      message: `La temperatura está fuera del rango de referencia (${tempRange[0]}–${tempRange[1]} °C). Requiere inspección.`,
      dewPointC,
      dewPointMarginC,
      temperatureDeviationC,
      humidityDeviationRh
    };
  }

  if (season === 'spring_summer' && humidityDeviationRh > 0) {
    return {
      state: 'red',
      title: 'Alerta higrométrica',
      message: 'La humedad está fuera del intervalo operativo preliminar de referencia (55–75 % HR). Requiere inspección.',
      dewPointC,
      dewPointMarginC,
      temperatureDeviationC,
      humidityDeviationRh
    };
  }

  const historicalTemps = history.map((row) => row.temperature_c).filter((v): v is number => typeof v === 'number');
  const historicalHumidity = history.map((row) => row.humidity_rh).filter((v): v is number => typeof v === 'number');
  const historicalAcoustic = history.map((row) => row.acoustic_energy).filter((v): v is number => typeof v === 'number');
  const historicalDewMargin = history.map((row) => row.dew_point_margin_c).filter((v): v is number => typeof v === 'number');

  if (isStatisticallyUnusual(temperature, historicalTemps)) {
    return {
      state: 'yellow',
      title: 'Seguimiento térmico',
      message: 'La temperatura continúa dentro del rango fisiológico, pero cambió respecto de su comportamiento histórico comparable.',
      dewPointC,
      dewPointMarginC,
      temperatureDeviationC,
      humidityDeviationRh
    };
  }

  if (season === 'spring_summer' && isStatisticallyUnusual(humidity, historicalHumidity)) {
    return {
      state: 'yellow',
      title: 'Seguimiento higrométrico',
      message: 'La humedad continúa dentro del intervalo operativo, pero cambió respecto de su comportamiento histórico comparable.',
      dewPointC,
      dewPointMarginC,
      temperatureDeviationC,
      humidityDeviationRh
    };
  }

  if (season === 'autumn_winter' && isStatisticallyUnusual(dewPointMarginC, historicalDewMargin, 'low')) {
    return {
      state: 'yellow',
      title: 'Seguimiento de proximidad al punto de rocío',
      message: 'El margen respecto del punto de rocío disminuyó de forma inusual frente al historial de la misma condición temporal.',
      dewPointC,
      dewPointMarginC,
      temperatureDeviationC,
      humidityDeviationRh
    };
  }

  // En primavera-verano, mañana/tarde son franjas en las que se espera movimiento.
  // El Hijo entrega el indicador ya resumido; si el registro horario es 0, la persistencia
  // supera holgadamente el criterio preliminar de 10 minutos planteado en la tesis.
  if (season === 'spring_summer' && (timeBand === 'manana' || timeBand === 'tarde') && activity === false) {
    return {
      state: 'yellow',
      title: 'Actividad en piquera reducida',
      message: 'No se detectó actividad en una franja de primavera-verano donde se espera movimiento. Es una variable contextual: requiere seguimiento junto con temperatura, humedad y acústica.',
      dewPointC,
      dewPointMarginC,
      temperatureDeviationC,
      humidityDeviationRh
    };
  }

  if (season === 'spring_summer' && swarmBandDetected) {
    return {
      state: 'yellow',
      title: 'Componente acústica contextual 500–600 Hz',
      message: 'El análisis acústico reportó energía en una banda asociada en antecedentes con períodos de enjambrazón. No constituye diagnóstico y debe interpretarse con el resto de las variables.',
      dewPointC,
      dewPointMarginC,
      temperatureDeviationC,
      humidityDeviationRh
    };
  }

  if (isStatisticallyUnusual(acousticEnergy, historicalAcoustic)) {
    return {
      state: 'yellow',
      title: 'Cambio acústico inusual',
      message: 'La energía acústica se apartó del comportamiento histórico de la misma estación y franja. Se usa como variable contextual y no como diagnóstico.',
      dewPointC,
      dewPointMarginC,
      temperatureDeviationC,
      humidityDeviationRh
    };
  }

  return {
    state: 'green',
    title: null,
    message: null,
    dewPointC,
    dewPointMarginC,
    temperatureDeviationC,
    humidityDeviationRh
  };
}
