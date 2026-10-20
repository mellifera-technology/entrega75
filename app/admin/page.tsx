import Link from 'next/link';
import { Antenna, ArrowRight, Boxes, PackageCheck, UserRound, Users } from 'lucide-react';
import { CreateOrderCard } from '@/components/create-order-card';
import { StatusBadge } from '@/components/status-badge';
import { requireAdmin } from '@/lib/auth';
import { formatDateTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  const [profilesRes, ordersRes, mothersRes, childrenRes] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('orders').select('*').order('created_at', { ascending: false }),
    supabase.from('mother_nodes').select('id,order_id,owner_id,mother_uid,active,last_seen_at,created_at').order('created_at', { ascending: false }),
    supabase.from('child_nodes').select('id,owner_id,last_seen_at,active')
  ]);
  const err = [profilesRes.error, ordersRes.error, mothersRes.error, childrenRes.error].find(Boolean);
  if (err) throw err;
  const profiles = profilesRes.data || [];
  const orders = ordersRes.data || [];
  const mothers = mothersRes.data || [];
  const children = childrenRes.data || [];

  const orderByOwner = new Map(orders.filter((o:any)=>o.claimed_by).map((o:any)=>[o.claimed_by,o]));
  const motherByOwner = new Map(mothers.filter((m:any)=>m.owner_id).map((m:any)=>[m.owner_id,m]));
  const countByOwner = new Map<string,number>();
  children.forEach((c:any)=>countByOwner.set(c.owner_id,(countByOwner.get(c.owner_id)||0)+1));

  const users = profiles.filter((p:any)=>p.role === 'user');
  const availableOrders = orders.filter((o:any)=>o.status === 'available').length;

  return <main className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
    <div><div className="text-xs font-black uppercase tracking-[.2em] text-amber-300">Administración</div><h1 className="mt-2 text-4xl font-black tracking-[-.04em]">Usuarios, pedidos y dispositivos</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">El ID público se genera al crear la cuenta y queda oculto para el cliente. Desde acá se ve la relación pedido → usuario → Nodo Madre → Nodos Hijo.</p></div>
    <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[[Users,'Usuarios clientes',users.length],[PackageCheck,'Pedidos disponibles',availableOrders],[Antenna,'Nodos Madre',mothers.length],[Boxes,'Nodos Hijo',children.length]].map(([Icon,label,val]:any)=><div key={label} className="glass rounded-2xl p-5"><Icon className="h-4 w-4 text-amber-300"/><div className="mt-4 text-3xl font-black">{val}</div><div className="mt-1 text-xs text-slate-600">{label}</div></div>)}</div>

    <div className="mt-7 grid gap-6 xl:grid-cols-[1fr_390px]">
      <section className="glass overflow-hidden rounded-3xl"><div className="border-b border-white/5 p-5 sm:p-6"><div className="flex items-center gap-2"><UserRound className="h-5 w-5 text-amber-300"/><h2 className="text-xl font-black">Usuarios creados</h2></div></div><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-xs"><thead><tr className="border-b border-white/5 text-slate-600">{['Usuario','Rol','ID único','Pedido','Nodo Madre','Hijos','Última madre','Acceso'].map(h=><th key={h} className="px-4 py-3 font-bold">{h}</th>)}</tr></thead><tbody>{profiles.map((user:any)=>{const order:any=orderByOwner.get(user.id); const mother:any=motherByOwner.get(user.id); return <tr key={user.id} className="border-b border-white/[.035]"><td className="px-4 py-4"><div className="font-bold text-slate-300">{user.full_name}</div><div className="mt-1 text-[10px] text-slate-700">{user.email}</div></td><td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${user.role==='admin'?'bg-amber-300/10 text-amber-300':'bg-white/5 text-slate-400'}`}>{user.role}</span></td><td className="px-4 py-4"><code className="text-[11px] text-amber-300">{user.public_id}</code></td><td className="px-4 py-4 font-mono text-[11px]">{order?.code || '—'}</td><td className="px-4 py-4"><div className="font-mono text-[11px]">{mother?.mother_uid || '—'}</div>{mother&&<div className="mt-1"><StatusBadge state={mother.active?'green':'white'} label={mother.active?'Activo':'Inactivo'}/></div>}</td><td className="px-4 py-4 font-black">{countByOwner.get(user.id)||0}</td><td className="px-4 py-4 text-slate-500">{formatDateTime(mother?.last_seen_at)}</td><td className="px-4 py-4"><Link href={`/dashboard?as_user=${user.id}`} className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-3 py-2 font-bold text-slate-300 hover:text-amber-300">Ver como usuario <ArrowRight className="h-3 w-3"/></Link></td></tr>})}{!profiles.length&&<tr><td colSpan={8} className="p-10 text-center text-slate-600">Todavía no hay clientes registrados.</td></tr>}</tbody></table></div></section>
      <div className="space-y-6"><CreateOrderCard/><div className="glass rounded-3xl p-5"><h2 className="font-black">Pedidos recientes</h2><div className="mt-4 space-y-2">{orders.slice(0,10).map((order:any)=><div key={order.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 p-3"><div className="min-w-0"><div className="truncate font-mono text-xs font-bold">{order.code}</div><div className="mt-1 text-[10px] text-slate-700">{formatDateTime(order.created_at)}</div></div><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${order.status==='available'?'bg-emerald-300/10 text-emerald-300':order.status==='claimed'?'bg-white/5 text-slate-400':'bg-red-300/10 text-red-300'}`}>{order.status}</span></div>)}</div></div></div>
    </div>
  </main>;
}
