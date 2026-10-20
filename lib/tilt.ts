export interface HiveGeometry {
  standardBoxes: number;
  threeQuarterBoxes: number;
  halfBoxes: number;
}

// IRAM 114001:2000 según la tesis: apoyo exterior 50,5 x 41,4 cm;
// alturas: estándar 242 mm, 3/4 190 mm y media alza 148 mm.
export function calculateTiltGeometry(geometry: HiveGeometry) {
  const standard = Math.max(0, Math.floor(geometry.standardBoxes));
  const threeQuarter = Math.max(0, Math.floor(geometry.threeQuarterBoxes));
  const half = Math.max(0, Math.floor(geometry.halfBoxes));
  const heightCm = standard * 24.2 + threeQuarter * 19 + half * 14.8;

  if (heightCm <= 0) {
    return { heightCm: 0, longitudinalDeg: 0, lateralDeg: 0, criticalDeg: 0 };
  }

  const lengthCm = 50.5;
  const widthCm = 41.4;
  const longitudinalDeg = Math.atan(lengthCm / (2 * heightCm)) * 180 / Math.PI;
  const lateralDeg = Math.atan(widthCm / (2 * heightCm)) * 180 / Math.PI;
  return {
    heightCm,
    longitudinalDeg,
    lateralDeg,
    criticalDeg: Math.min(longitudinalDeg, lateralDeg)
  };
}
