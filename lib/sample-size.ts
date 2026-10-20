const T95: Record<number, number> = {
  1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447,
  7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228, 11: 2.201, 12: 2.179,
  13: 2.160, 14: 2.145, 15: 2.131, 16: 2.120, 17: 2.110, 18: 2.101,
  19: 2.093, 20: 2.086, 21: 2.080, 22: 2.074, 23: 2.069, 24: 2.064,
  25: 2.060, 26: 2.056, 27: 2.052, 28: 2.048, 29: 2.045, 30: 2.042,
  40: 2.021, 60: 2.000, 120: 1.980
};

function tCritical95(df: number) {
  if (df <= 1) return T95[1];
  if (T95[df]) return T95[df];
  if (df >= 120) return 1.96 + (1.98 - 1.96) * (120 / df);

  const keys = Object.keys(T95).map(Number).sort((a, b) => a - b);
  const lo = [...keys].reverse().find((k) => k < df)!;
  const hi = keys.find((k) => k > df)!;
  const ratio = (df - lo) / (hi - lo);
  return T95[lo] + (T95[hi] - T95[lo]) * ratio;
}

export interface SampleSizeResult {
  population: number;
  sample: number;
  coveragePercent: number;
  standardDeviation: number;
  maxErrorC: number;
  confidence: number;
}

export function calculateHiveSampleSize(population: number, standardDeviation = 1.8, maxErrorC = 1): SampleSizeResult {
  const N = Math.max(1, Math.floor(population));

  if (N <= 2) {
    return {
      population: N,
      sample: N,
      coveragePercent: 100,
      standardDeviation,
      maxErrorC,
      confidence: 95
    };
  }

  // Ecuación de media en población finita usada en la tesis. Como t depende de n,
  // se busca el menor n entero que satisface de forma conservadora la desigualdad.
  let selected = N;
  for (let n = 2; n <= N; n += 1) {
    const t = tCritical95(n - 1);
    const numerator = N * t * t * standardDeviation * standardDeviation;
    const denominator = (N - 1) * maxErrorC * maxErrorC + t * t * standardDeviation * standardDeviation;
    const required = numerator / denominator;
    if (n >= required) {
      selected = n;
      break;
    }
  }

  return {
    population: N,
    sample: selected,
    coveragePercent: Math.round((selected / N) * 1000) / 10,
    standardDeviation,
    maxErrorC,
    confidence: 95
  };
}
