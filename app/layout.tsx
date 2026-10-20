import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MELLIFERA TECHNOLOGY | Monitoreo inteligente de colmenas',
  description: 'Telemetría apícola IoT de bajo consumo, modular y pensada para el productor.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
