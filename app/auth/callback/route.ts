import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { ORDER_COOKIE, verifyOrderClaimCookie } from '@/lib/order-cookie';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const nextRaw = url.searchParams.get('next') || '/dashboard';
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/dashboard';
  const redirectError = (message: string) => NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent(message)}`, request.url));
  if (!code) return redirectError('No se recibió el código de autenticación.');

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return redirectError('No se pudo completar el acceso con Google.');

  const admin = createAdminSupabaseClient();
  const { data: existing } = await admin.from('profiles').select('id,active').eq('id', data.user.id).maybeSingle();
  if (existing?.active) return NextResponse.redirect(new URL(next, request.url));

  const claim = verifyOrderClaimCookie(request.cookies.get(ORDER_COOKIE)?.value);
  if (!claim) {
    await admin.auth.admin.deleteUser(data.user.id);
    return redirectError('Para crear una cuenta con Google primero necesitás validar un número de pedido.');
  }

  const email = data.user.email || '';
  const name = claim.displayName || String(data.user.user_metadata?.full_name || data.user.user_metadata?.name || 'Usuario MELLIFERA');
  const { error: claimError } = await admin.rpc('claim_order_for_user', {
    p_order_code: claim.orderCode,
    p_user_id: data.user.id,
    p_full_name: name,
    p_email: email
  });
  if (claimError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return redirectError('El pedido ya no está disponible o no pudo asociarse.');
  }

  const response = NextResponse.redirect(new URL(next, request.url));
  response.cookies.set(ORDER_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
