'use client';

import { useMemo } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface Point {
  measured_at: string;
  temperature_c: number | null;
  humidity_rh: number | null;
  acoustic_energy?: number | null;
}

export function TelemetryChart({ data }: { data: Point[] }) {
  const rows = useMemo(() => data.slice().reverse().map((row) => ({
    ...row,
    time: new Intl.DateTimeFormat('es-AR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Argentina/Buenos_Aires'
    }).format(new Date(row.measured_at))
  })), [data]);

  if (!rows.length) return <div className="flex h-72 items-center justify-center text-sm text-slate-600">Todavía no hay histórico para graficar.</div>;

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,.06)" />
          <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} minTickGap={28} />
          <YAxis yAxisId="temp" stroke="#64748b" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
          <YAxis yAxisId="hum" orientation="right" stroke="#64748b" tick={{ fontSize: 10 }} domain={[0, 100]} />
          <Tooltip contentStyle={{ background: '#0b1116', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12 }} labelStyle={{ color: '#cbd5e1' }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line yAxisId="temp" type="monotone" dataKey="temperature_c" name="Temperatura °C" stroke="#fcd34d" dot={false} connectNulls strokeWidth={2} />
          <Line yAxisId="hum" type="monotone" dataKey="humidity_rh" name="Humedad %" stroke="#6ee7b7" dot={false} connectNulls strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
