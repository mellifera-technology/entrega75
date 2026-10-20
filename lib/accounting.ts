export interface PartnerBalance {
  id: string;
  code: string;
  display_name: string;
  balance: number;
}

export function calculatePartnerShares(partners: PartnerBalance[], weighting = 0.5) {
  const safeWeight = Math.max(0, Math.min(1, weighting));
  const positiveBalances = partners.map((p) => Math.max(0, p.balance));
  const total = positiveBalances.reduce((a, b) => a + b, 0);
  const equalShare = partners.length ? 1 / partners.length : 0;

  return partners.map((partner, index) => {
    const proportional = total > 0 ? positiveBalances[index] / total : equalShare;
    const share = (1 - safeWeight) * equalShare + safeWeight * proportional;
    return { ...partner, share };
  });
}
