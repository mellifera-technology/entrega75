import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createOrderClaimCookie, ORDER_COOKIE } from '@/lib/order-cookie';

const schema = z.object({ orderCode: z.string().min(3), displayName: z.string().min(2).max(120) });

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const code = body.orderCode.trim().toUpperCase();
    const admin = createAdminSupabaseClient();
    const { data: order, error } = await admin.from('orders').select('id,status').eq('code', code).maybeSingle();
    if (error) throw error;
    if (!order || order.status !== 'available') return NextResponse.json({ error: 'El número de pedido no existe o ya fue utilizado.' }, { status: 400 });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(ORDER_COOKIE, createOrderClaimCookie(code, body.displayName), {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 15 * 60
    });
    return response;
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: 'Completá el número de pedido y el nombre.' }, { status: 400 });
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error de validación' }, { status: 500 });
  }
}
