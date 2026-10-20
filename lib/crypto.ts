import crypto from 'node:crypto';

export function sha256(value: string) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

export function randomDeviceSecret() {
  return crypto.randomBytes(32).toString('base64url');
}

export function randomMotherUid() {
  return `MOTHER-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

export function randomOrderCode() {
  const year = new Date().getFullYear().toString().slice(-2);
  return `MEL-${year}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}
