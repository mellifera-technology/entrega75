import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { sha256 } from '@/lib/crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ MOTHER_UID: z.string().trim().min(3).optional() });

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json().catch(() => ({})));
    const motherUid = body.MOTHER_UID || request.headers.get('x-mellifera-mother') || '';
    const apiKey = request.headers.get('x-mellifera-key') || '';
    if (!motherUid || !apiKey) return NextResponse.json({ error: 'Faltan credenciales.' }, { status: 401 });

    const admin = createAdminSupabaseClient();
    const { data: mother, error } = await admin
      .from('mother_nodes')
      .select('id,owner_id,mother_uid,api_key_hash,active')
      .eq('mother_uid', motherUid)
      .maybeSingle();
    if (error) throw error;
    if (!mother || !mother.active || sha256(apiKey) !== mother.api_key_hash) {
      return NextResponse.json({ error: 'Nodo Madre no autorizado.' }, { status: 401 });
    }
    if (!mother.owner_id) {
      return NextResponse.json({ ok: false, activated: false, message: 'El pedido todavía no fue activado por el cliente.' }, { status: 409 });
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('public_id,active')
      .eq('id', mother.owner_id)
      .single();
    if (profileError || !profile?.active) return NextResponse.json({ error: 'Cuenta inactiva.' }, { status: 403 });

    const { data: apiary } = await admin
      .from('apiaries')
      .select('id,name,timezone')
      .eq('owner_id', mother.owner_id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      activated: true,
      USER_ID: profile.public_id,
      MOTHER_UID: mother.mother_uid,
      apiary: apiary || null,
      upload_interval_seconds: 3 * 60 * 60
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
    console.error('device provision error', error);
    return NextResponse.json({ error: 'No se pudo provisionar el Nodo Madre.' }, { status: 500 });
  }
}
