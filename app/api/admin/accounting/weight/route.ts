import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';

const schema = z.object({ weighting: z.number().min(0).max(1) });
export async function PATCH(request: Request) {
  const { supabase } = await requireAdmin();
  try {
    const { weighting } = schema.parse(await request.json());
    const { error } = await supabase.from('app_settings').upsert({ key:'accounting_income_weight', value:weighting, updated_at:new Date().toISOString() }, { onConflict:'key' });
    if (error) throw error;
    return NextResponse.json({ ok:true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({error:'Valor inválido.'},{status:400});
    return NextResponse.json({error:'No se pudo guardar.'},{status:500});
  }
}
