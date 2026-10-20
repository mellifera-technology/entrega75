import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { calculateTiltGeometry } from '@/lib/tilt';

const schema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  standardBoxes: z.number().int().min(0).max(20).optional(),
  threeQuarterBoxes: z.number().int().min(0).max(20).optional(),
  halfBoxes: z.number().int().min(0).max(20).optional()
}).refine((value) => Object.values(value).some((item) => item !== undefined), 'Sin cambios');

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = schema.parse(await request.json());
    const supabase = await createServerSupabaseClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });

    const updates: Record<string, unknown> = {};
    if (body.displayName !== undefined) updates.display_name = body.displayName;

    if (body.standardBoxes !== undefined || body.threeQuarterBoxes !== undefined || body.halfBoxes !== undefined) {
      const { data: current, error: currentError } = await supabase.from('child_nodes').select('standard_boxes,three_quarter_boxes,half_boxes').eq('id', id).single();
      if (currentError || !current) return NextResponse.json({ error: 'Colmena no encontrada.' }, { status: 404 });
      const geometry = calculateTiltGeometry({
        standardBoxes: body.standardBoxes ?? current.standard_boxes,
        threeQuarterBoxes: body.threeQuarterBoxes ?? current.three_quarter_boxes,
        halfBoxes: body.halfBoxes ?? current.half_boxes
      });
      if (geometry.heightCm <= 0) return NextResponse.json({ error: 'La colmena debe tener al menos una caja/alza.' }, { status: 400 });
      updates.standard_boxes = body.standardBoxes ?? current.standard_boxes;
      updates.three_quarter_boxes = body.threeQuarterBoxes ?? current.three_quarter_boxes;
      updates.half_boxes = body.halfBoxes ?? current.half_boxes;
      updates.estimated_height_cm = geometry.heightCm;
      updates.critical_tilt_deg = geometry.criticalDeg;
    }

    const { error } = await supabase.from('child_nodes').update(updates).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
    return NextResponse.json({ error: 'No se pudo actualizar la colmena.' }, { status: 500 });
  }
}
