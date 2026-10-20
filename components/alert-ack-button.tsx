'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function AlertAckButton({ id, acknowledged }: { id: string; acknowledged: boolean }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  if (acknowledged) return <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-300"><Check className="h-3.5 w-3.5"/> Revisada</span>;
  return <button disabled={loading} onClick={async()=>{setLoading(true); await fetch(`/api/alerts/${id}/ack`, {method:'POST'}); setLoading(false); router.refresh();}} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-bold text-slate-400 hover:text-white">{loading?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Check className="h-3.5 w-3.5"/>} Marcar revisada</button>;
}
