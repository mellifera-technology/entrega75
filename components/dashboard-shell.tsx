'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, Boxes, ChartNoAxesCombined, Gauge, LogOut, Settings, Shield, UserRound } from 'lucide-react';
import { Logo } from '@/components/logo';
import type { Role } from '@/lib/types';

export function DashboardShell({
  children,
  role,
  fullName,
  email
}: {
  children: React.ReactNode;
  role: Role;
  fullName: string;
  email: string;
}) {
  const params = useSearchParams();
  const viewedUser = role === 'admin' ? params.get('as_user') : null;
  const suffix = viewedUser ? `?as_user=${encodeURIComponent(viewedUser)}` : '';
  const dashboardHref = `/dashboard${suffix}`;
  const indicatorsHref = `/dashboard/indicators${suffix}`;
  const alertsHref = `/dashboard/alerts${suffix}`;
  const settingsHref = `/dashboard/settings${suffix}`;
  const hivesHref = viewedUser ? `/dashboard?as_user=${encodeURIComponent(viewedUser)}#colmenas` : '/dashboard#colmenas';

  return (
    <div className="min-h-screen bg-[#070b0f]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-white/5 bg-[#090e12]/95 p-5 backdrop-blur lg:block">
        <Logo />
        <nav className="mt-10 space-y-1 text-sm">
          <Link href={dashboardHref} className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-bold text-slate-300 hover:bg-white/[.05] hover:text-white"><Gauge className="h-4 w-4"/> Resumen</Link>
          <Link href={indicatorsHref} className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-bold text-slate-300 hover:bg-white/[.05] hover:text-white"><ChartNoAxesCombined className="h-4 w-4"/> Indicadores</Link>
          <Link href={hivesHref} className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-bold text-slate-300 hover:bg-white/[.05] hover:text-white"><Boxes className="h-4 w-4"/> Colmenas</Link>
          <Link href={alertsHref} className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-bold text-slate-300 hover:bg-white/[.05] hover:text-white"><AlertTriangle className="h-4 w-4"/> Alertas</Link>
          <Link href={settingsHref} className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-bold text-slate-300 hover:bg-white/[.05] hover:text-white"><Settings className="h-4 w-4"/> Configuración</Link>
          {role === 'admin' && <Link href="/admin" className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-bold text-amber-300 hover:bg-amber-300/[.06]"><Shield className="h-4 w-4"/> Administración</Link>}
        </nav>
        <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/5 bg-white/[.025] p-4">
          {viewedUser && <div className="mb-3 rounded-lg border border-amber-300/10 bg-amber-300/[.04] px-2.5 py-2 text-[10px] font-bold text-amber-300">VISTA DE CLIENTE ACTIVA</div>}
          <div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-white/5"><UserRound className="h-4 w-4 text-slate-400"/></div><div className="min-w-0"><div className="truncate text-sm font-bold">{fullName}</div><div className="truncate text-xs text-slate-600">{email}</div></div></div>
          <form action="/api/auth/logout" method="post" className="mt-3"><button className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/5 px-3 py-2 text-xs font-bold text-slate-500 hover:text-white"><LogOut className="h-3.5 w-3.5"/> Cerrar sesión</button></form>
        </div>
      </aside>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-[#070b0f]/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo compact />
        <div className="flex gap-2 text-xs font-bold"><Link href={dashboardHref}>Resumen</Link><Link href={alertsHref}>Alertas</Link><Link href={settingsHref}>Ajustes</Link>{role === 'admin' && <Link href="/admin" className="text-amber-300">Admin</Link>}</div>
      </header>
      <main className="lg:pl-64">{children}</main>
    </div>
  );
}
