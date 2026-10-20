import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const schema = z.object({ username: z.string(), password: z.string() });

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const expectedUser = process.env.ADMIN_USERNAME || 'admin';
    const expectedPassword = process.env.ADMIN_PASSWORD || 'admin';
    const email = process.env.ADMIN_EMAIL || 'admin@mellifera.local';
    if (body.username !== expectedUser || body.password !== expectedPassword) return NextResponse.json({ error: 'Usuario o contraseña incorrectos.' }, { status: 401 });

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: expectedPassword });
    if (error || !data.user) return NextResponse.json({ error: 'El admin todavía no fue inicializado. Ejecutá npm run bootstrap:admin.' }, { status: 401 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }
}
