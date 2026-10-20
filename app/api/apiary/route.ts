import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const schema = z.object({ ownerId: z.string().uuid(), name: z.string().trim().min(1).max(100), locationText: z.string().trim().max(180).nullable().optional(), totalHives: z.number().int().min(1).max(100000).nullable().optional() });

export async function PATCH(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single();
    if (body.ownerId !== auth.user.id && profile?.role !== 'admin') return NextResponse.json({ error: 'Sin permisos.' }, { status: 403 });
    const { error } = await supabase.from('apiaries').update({ name: body.name, location_text: body.locationText || null, total_hives: body.totalHives ?? null }).eq('owner_id', body.ownerId);
    if (error) throw error;
    return NextResponse.json({ ok:true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error:'Datos inválidos.' }, { status:400 });
    return NextResponse.json({ error:'No se pudo actualizar el apiario.' }, { status:500 });
  }
}
