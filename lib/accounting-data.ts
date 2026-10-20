import { calculatePartnerShares, type PartnerBalance } from '@/lib/accounting';

export function buildPartnerBalances(partners: any[], entries: any[]): PartnerBalance[] {
  return partners.map((partner) => {
    const balance = entries.reduce((sum, entry) => {
      if (entry.payer_partner_id !== partner.id) return sum;
      const amount = Number(entry.amount || 0);
      if (entry.entry_type === 'contribution' || entry.entry_type === 'expense') return sum + amount;
      if (entry.entry_type === 'reimbursement') return sum - amount;
      return sum;
    }, 0);
    return { id: partner.id, code: partner.code, display_name: partner.display_name, balance };
  });
}

export function suggestedShares(partners: any[], entries: any[], weighting: number) {
  return calculatePartnerShares(buildPartnerBalances(partners, entries), weighting);
}
