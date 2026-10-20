import type { Season, TimeBand } from '@/lib/types';

export const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

function localParts(date: Date, timeZone = DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour)
  };
}

export function getSeason(date: Date, timeZone = DEFAULT_TIMEZONE): Season {
  // Criterio operativo del proyecto para hemisferio sur:
  // septiembre-febrero = primavera/verano; marzo-agosto = otoño/invierno.
  const { month } = localParts(date, timeZone);
  return month >= 9 || month <= 2 ? 'spring_summer' : 'autumn_winter';
}

export function getTimeBand(date: Date, timeZone = DEFAULT_TIMEZONE): TimeBand {
  const { hour } = localParts(date, timeZone);
  if (hour < 6) return 'madrugada';
  if (hour < 12) return 'manana';
  if (hour < 18) return 'tarde';
  return 'noche';
}

export function formatDateTime(value?: string | null, timeZone = DEFAULT_TIMEZONE) {
  if (!value) return 'Sin datos';
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone
  }).format(new Date(value));
}

export function formatDate(value?: string | null, timeZone = DEFAULT_TIMEZONE) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeZone
  }).format(new Date(value));
}
