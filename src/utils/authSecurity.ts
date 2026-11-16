import crypto from 'node:crypto';

export const DEFAULT_APP_PASSWORD = 'equilibrio2026';

export function hashPassword(password: string): string {
  return crypto
    .createHash('sha256')
    .update(`equilibrio-pwd-salt::${password.trim()}`)
    .digest('hex');
}

export function deriveSessionToken(passwordHash: string): string {
  return crypto
    .createHmac('sha256', passwordHash)
    .update('equilibrio-authenticated-session-v1')
    .digest('hex');
}

export function safeCompareHex(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  try {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function verifyPasswordAgainstHash(
  candidatePassword: string,
  expectedHash: string
): boolean {
  if (typeof candidatePassword !== 'string' || !candidatePassword.trim()) {
    return false;
  }
  const candidateHash = hashPassword(candidatePassword);
  return safeCompareHex(candidateHash, expectedHash);
}

export function verifySessionTokenAgainstHash(
  candidateToken: string | undefined | null,
  activePasswordHash: string
): boolean {
  if (typeof candidateToken !== 'string' || !candidateToken.trim()) {
    return false;
  }
  const expectedToken = deriveSessionToken(activePasswordHash);
  return safeCompareHex(candidateToken.trim(), expectedToken);
}
