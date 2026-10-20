import Link from 'next/link';
import { Calculator, Gauge, LogOut, Users } from 'lucide-react';
import { Logo } from '@/components/logo';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <div className="min-h-screen bg-[#070b0f]"><header className="sticky top-0 z-30 border-b border-white/5 bg-[#070b0f]/90 backdrop-blur"><div className="mx-auto flex max-w-[1500px] items-center justify-between gap-5 px-4 py-4 sm:px-6 lg:px-8"><Logo/><nav className="flex items-center gap-2 text-sm font-bold"><Link href="/admin" className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-white/5"><Users className="h-4 w-4"/> Usuarios</Link><Link href="/admin/accounting" className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-white/5"><Calculator className="h-4 w-4"/> Contabilidad</Link><Link href="/dashboard" className="hidden items-center gap-2 rounded-xl px-3 py-2 hover:bg-white/5 sm:flex"><Gauge className="h-4 w-4"/> Mi dashboard</Link><form action="/api/auth/logout" method="post"><button className="grid h-9 w-9 place-items-center rounded-xl border border-white/5 text-slate-500 hover:text-white" title="Cerrar sesión"><LogOut className="h-4 w-4"/></button></form></nav></div></header>{children}</div>;
}
