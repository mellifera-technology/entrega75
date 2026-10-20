import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { buildPartnerBalances } from '@/lib/accounting-data';
import { calculatePartnerShares } from '@/lib/accounting';

const schema = z.object({
  entryType: z.enum(['contribution','expense','reimbursement','income']),
  partnerId: z.string().uuid().nullable().optional(),
  amount: z.coerce.number().positive().max(100000000000),
  description: z.string().trim().min(2).max(300),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export async function POST(request: Request) {
  const { profile, supabase } = await requireAdmin();
  try {
    const body = schema.parse(await request.json());
    if (body.entryType !== 'income' && !body.partnerId) return NextResponse.json({ error: 'Elegí a Chiara o Lucas.' }, { status: 400 });

    const { data: inserted, error: insertError } = await supabase.from('accounting_entries').insert({
      entry_type: body.entryType,
      payer_partner_id: body.entryType === 'income' ? null : body.partnerId,
      amount: body.amount,
      description: body.description,
      entry_date: body.entryDate,
      created_by: profile.id
    }).select('*').single();
    if (insertError) throw insertError;

    if (body.entryType === 'income') {
      const [{ data: partners, error: partnerError }, { data: entries, error: entriesError }, { data: setting }] = await Promise.all([
        supabase.from('accounting_partners').select('*').eq('active', true).order('code'),
        supabase.from('accounting_entries').select('*').neq('id', inserted.id),
        supabase.from('app_settings').select('value').eq('key','accounting_income_weight').maybeSingle()
      ]);
      if (partnerError || entriesError) throw partnerError || entriesError;
      const weighting = Math.max(0, Math.min(1, Number(setting?.value ?? 0.5)));
      const balances = buildPartnerBalances(partners || [], entries || []);
      const shares = calculatePartnerShares(balances, weighting);
      let allocated = 0;
      const allocations = shares.map((share, index) => {
        const isLast = index === shares.length - 1;
        const amount = isLast ? Math.round((body.amount - allocated) * 100) / 100 : Math.round(body.amount * share.share * 100) / 100;
        allocated += amount;
        return { income_entry_id: inserted.id, partner_id: share.id, share_percent: Number((share.share * 100).toFixed(5)), allocated_amount: amount };
      });
      const { error: allocationError } = await supabase.from('income_allocations').insert(allocations);
      if (allocationError) { await supabase.from('accounting_entries').delete().eq('id', inserted.id); throw allocationError; }
      return NextResponse.json({ ok:true, entry:inserted, allocations });
    }

    return NextResponse.json({ ok:true, entry:inserted });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error:error.errors[0]?.message || 'Datos inválidos.' }, { status:400 });
    console.error(error);
    return NextResponse.json({ error:'No se pudo registrar el movimiento.' }, { status:500 });
  }
}
