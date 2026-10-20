import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const schema = z.object({
  orderCode: z.string().min(3),
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres')
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const code = body.orderCode.trim().toUpperCase();
    const admin = createAdminSupabaseClient();

    const { data: order } = await admin.from('orders').select('id,status').eq('code', code).maybeSingle();
    if (!order || order.status !== 'available') return NextResponse.json({ error: 'El número de pedido no existe o ya fue utilizado.' }, { status: 400 });

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: body.email.trim().toLowerCase(),
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: body.fullName.trim() }
    });
    if (createError || !created.user) return NextResponse.json({ error: createError?.message || 'No se pudo crear el usuario.' }, { status: 400 });

    const { error: claimError } = await admin.rpc('claim_order_for_user', {
      p_order_code: code,
      p_user_id: created.user.id,
      p_full_name: body.fullName.trim(),
      p_email: body.email.trim().toLowerCase()
    });

    if (claimError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return NextResponse.json({ error: 'El pedido no pudo vincularse a la cuenta.' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: body.email.trim().toLowerCase(), password: body.password });
    if (signInError) return NextResponse.json({ error: 'La cuenta fue creada, pero no se pudo iniciar sesión automáticamente.' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.errors[0]?.message || 'Datos inválidos' }, { status: 400 });
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error interno' }, { status: 500 });
  }
}
