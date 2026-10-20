import crypto from 'node:crypto';

export const ORDER_COOKIE = 'mellifera_order_claim';

interface ClaimPayload {
  orderCode: string;
  displayName: string;
  exp: number;
}

function secret() {
  const value = process.env.ORDER_COOKIE_SECRET;
  if (!value) throw new Error('Falta ORDER_COOKIE_SECRET');
  return value;
}

function sign(payload: string) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createOrderClaimCookie(orderCode: string, displayName: string) {
  const payload: ClaimPayload = {
    orderCode: orderCode.trim().toUpperCase(),
    displayName: displayName.trim(),
    exp: Date.now() + 15 * 60 * 1000
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

export function verifyOrderClaimCookie(value?: string | null): ClaimPayload | null {
  if (!value) return null;
  const [encoded, signature] = value.split('.');
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as ClaimPayload;
    if (!payload.orderCode || !payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
