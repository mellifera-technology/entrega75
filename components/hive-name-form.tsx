'use client';

import { FormEvent, useState } from 'react';
import { Check, Loader2, Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function HiveNameForm({ id, initialName }: { id: string; initialName: string }) {
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const response = await fetch(`/api/hives/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: name })
    });
    setLoading(false);
    if (response.ok) { setEditing(false); router.refresh(); }
  }

  if (!editing) return <button onClick={() => setEditing(true)} className="inline-flex items-center gap-2 text-3xl font-black tracking-[-.04em] hover:text-amber-300 sm:text-4xl">{initialName}<Pencil className="h-4 w-4 text-slate-600"/></button>;
  return <form onSubmit={submit} className="flex max-w-lg gap-2"><input autoFocus value={name} onChange={(e)=>setName(e.target.value)} className="min-w-0 flex-1 px-3 py-2 text-lg font-black" maxLength={80}/><button className="grid w-11 place-items-center rounded-xl bg-amber-300 text-[#151109]" disabled={loading}>{loading?<Loader2 className="h-4 w-4 animate-spin"/>:<Check className="h-4 w-4"/>}</button></form>;
}
