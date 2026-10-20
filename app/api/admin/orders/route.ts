import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { randomDeviceSecret, randomMotherUid, randomOrderCode, sha256 } from '@/lib/crypto';

const schema = z.object({ code: z.string().trim().min(3).max(80).optional(), customerNote: z.string().trim().max(300).optional() });

export async function POST(request: Request) {
  await requireAdmin();
  try {
    const body = schema.parse(await request.json());
    const admin = createAdminSupabaseClient();
    const code = (body.code || randomOrderCode()).toUpperCase();
    const motherUid = randomMotherUid();
    const apiKey = randomDeviceSecret();

    const { data: order, error: orderError } = await admin.from('orders').insert({ code, customer_note: body.customerNote || null }).select('id,code,status,created_at').single();
    if (orderError) return NextResponse.json({ error: orderError.code === '23505' ? 'Ese número de pedido ya existe.' : orderError.message }, { status: 400 });

    const { error: motherError } = await admin.from('mother_nodes').insert({ order_id: order.id, mother_uid: motherUid, api_key_hash: sha256(apiKey), active: true });
    if (motherError) {
      await admin.from('orders').delete().eq('id', order.id);
      throw motherError;
    }

    return NextResponse.json({ ok: true, order, device: { MOTHER_UID: motherUid, API_KEY: apiKey } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: 'No se pudo crear el pedido.' }, { status: 500 });
  }
}
