"use client";

import { FormEvent, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Chrome, KeyRound, Loader2, Mail, PackageCheck, Shield } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

function Field({ label, type = 'text', value, onChange, placeholder, autoComplete }: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-300">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full px-4 py-3"
      />
    </label>
  );
}

export function AuthCard() {
  const params = useSearchParams();
  const initialMode = params.get('mode') === 'register' ? 'register' : params.get('admin') === '1' ? 'admin' : 'login';
  const [mode, setMode] = useState<'login' | 'register' | 'admin'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [orderCode, setOrderCode] = useState('');
  const [adminUser, setAdminUser] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(params.get('error') || '');
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  async function loginWithGoogle(asRegistration = false) {
    setError('');
    setLoading(true);
    try {
      if (asRegistration) {
        const verify = await fetch('/api/auth/verify-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderCode, displayName: name })
        });
        const data = await verify.json();
        if (!verify.ok) throw new Error(data.error || 'No se pudo validar el pedido');
      }

      const origin = window.location.origin;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${origin}/auth/callback?next=/dashboard` }
      });
      if (oauthError) throw oauthError;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de autenticación');
      setLoading(false);
    }
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) {
      setError('Correo o contraseña incorrectos.');
      setLoading(false);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderCode, fullName: name, email, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo crear la cuenta');
      router.push('/dashboard');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la cuenta');
      setLoading(false);
    }
  }

  async function handleAdmin(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/auth/admin-login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUser, password: adminPassword })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Acceso denegado');
      router.push('/admin'); router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Acceso denegado');
      setLoading(false);
    }
  }

  return (
    <div className="glass w-full max-w-md rounded-[30px] p-6 shadow-glow md:p-8">
      <div className="mb-6 grid grid-cols-3 rounded-xl border border-white/5 bg-black/20 p-1 text-xs font-bold">
        {(['login','register','admin'] as const).map((item) => (
          <button key={item} onClick={() => { setMode(item); setError(''); }} className={`rounded-lg px-3 py-2.5 transition ${mode === item ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
            {item === 'login' ? 'Ingresar' : item === 'register' ? 'Crear cuenta' : 'Admin'}
          </button>
        ))}
      </div>

      {mode === 'login' && (
        <>
          <div className="mb-6"><h1 className="text-2xl font-black">Bienvenido de nuevo</h1><p className="mt-2 text-sm leading-6 text-slate-500">El número de pedido no vuelve a pedirse después de activar tu cuenta.</p></div>
          <button disabled={loading} onClick={() => loginWithGoogle(false)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 font-bold hover:bg-white/[.07]"><Chrome className="h-4 w-4"/> Continuar con Google</button>
          <div className="my-5 flex items-center gap-3 text-xs text-slate-600"><span className="h-px flex-1 bg-white/5"/> o <span className="h-px flex-1 bg-white/5"/></div>
          <form onSubmit={handleLogin} className="space-y-4">
            <Field label="Correo" type="email" value={email} onChange={setEmail} autoComplete="email" />
            <Field label="Contraseña" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
            <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 py-3 font-black text-[#171108] disabled:opacity-60">{loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Mail className="h-4 w-4"/>} Ingresar</button>
          </form>
        </>
      )}

      {mode === 'register' && (
        <>
          <div className="mb-6"><h1 className="text-2xl font-black">Activar MELLIFERA</h1><p className="mt-2 text-sm leading-6 text-slate-500">Primero validamos que exista un pedido disponible. Ese código se usa una sola vez.</p></div>
          <form onSubmit={handleRegister} className="space-y-4">
            <Field label="Número de pedido" value={orderCode} onChange={(v)=>setOrderCode(v.toUpperCase())} placeholder="MEL-26-XXXXXXXX" />
            <Field label="Nombre" value={name} onChange={setName} autoComplete="name" />
            <Field label="Correo" type="email" value={email} onChange={setEmail} autoComplete="email" />
            <Field label="Crear contraseña" type="password" value={password} onChange={setPassword} autoComplete="new-password" />
            <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 py-3 font-black text-[#171108] disabled:opacity-60">{loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <PackageCheck className="h-4 w-4"/>} Validar pedido y crear cuenta</button>
          </form>
          <div className="my-5 flex items-center gap-3 text-xs text-slate-600"><span className="h-px flex-1 bg-white/5"/> o <span className="h-px flex-1 bg-white/5"/></div>
          <button disabled={loading || !orderCode || !name} onClick={() => loginWithGoogle(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 font-bold disabled:opacity-40"><Chrome className="h-4 w-4"/> Validar pedido y continuar con Google</button>
        </>
      )}

      {mode === 'admin' && (
        <>
          <div className="mb-6"><h1 className="flex items-center gap-2 text-2xl font-black"><Shield className="h-5 w-5 text-amber-300"/> Administración</h1><p className="mt-2 text-sm text-slate-500">Acceso interno de MELLIFERA.</p></div>
          <form onSubmit={handleAdmin} className="space-y-4">
            <Field label="Usuario" value={adminUser} onChange={setAdminUser} autoComplete="username" />
            <Field label="Contraseña" type="password" value={adminPassword} onChange={setAdminPassword} autoComplete="current-password" />
            <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 font-black text-[#0b1014]">{loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <KeyRound className="h-4 w-4"/>} Entrar al panel admin</button>
          </form>
        </>
      )}

      {error && <div className="mt-5 rounded-xl border border-red-300/15 bg-red-300/5 p-3 text-sm leading-5 text-red-200">{decodeURIComponent(error)}</div>}
    </div>
  );
}
