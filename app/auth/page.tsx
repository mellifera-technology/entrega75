import Link from 'next/link';
import { Suspense } from 'react';
import { AuthCard } from '@/components/auth-card';
import { Logo } from '@/components/logo';

export default function AuthPage() {
  return (
    <main className="grid-noise min-h-screen px-5 py-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between"><Logo/><Link href="/" className="text-sm text-slate-500 hover:text-white">Volver al inicio</Link></div>
      <div className="mx-auto grid max-w-6xl gap-10 pt-12 lg:grid-cols-[1fr_.85fr] lg:items-center lg:pt-24">
        <div className="hidden lg:block">
          <div className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Área de clientes</div>
          <h2 className="mt-4 max-w-xl text-5xl font-black tracking-[-.05em]">Tus colmenas, organizadas en una sola vista.</h2>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-400">Accedé al estado general del apiario, alertas, históricos y detalle de cada Nodo Hijo. La activación inicial queda asociada a tu número de pedido.</p>
        </div>
        <div className="flex justify-center lg:justify-end"><Suspense><AuthCard/></Suspense></div>
      </div>
    </main>
  );
}
