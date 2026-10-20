import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';

export async function requireViewer(): Promise<{ profile: Profile; supabase: Awaited<ReturnType<typeof createServerSupabaseClient>> }> {
  const supabase = await createServerSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    redirect('/auth');
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (error || !profile || !profile.active) {
    await supabase.auth.signOut();
    redirect('/auth?error=Cuenta%20sin%20habilitaci%C3%B3n');
  }

  return { profile: profile as Profile, supabase };
}

export async function requireAdmin() {
  const ctx = await requireViewer();
  if (ctx.profile.role !== 'admin') redirect('/dashboard');
  return ctx;
}

export async function resolveOwnerId(viewer: Profile, requestedOwnerId?: string | null) {
  if (viewer.role === 'admin' && requestedOwnerId) return requestedOwnerId;
  return viewer.id;
}
