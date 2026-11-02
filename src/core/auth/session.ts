const DAY_MS = 24 * 60 * 60 * 1000;

/** A session lasts this long after the last time it was extended. */
export const SESSION_DAYS = 30;
/** Sessions with fewer days than this left are extended on the next request. */
export const REFRESH_WHEN_DAYS_LEFT = 15;

const toHex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** 256 random bits, URL-safe. This is what goes in the cookie. */
export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** What the database stores, so a leaked database can't be used to sign in. */
export async function hashToken(token: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));
}

export const newExpiry = (now: Date) => new Date(now.getTime() + SESSION_DAYS * DAY_MS);

export function sessionState(expiresAt: Date, now: Date): 'expired' | 'refresh' | 'valid' {
  const left = expiresAt.getTime() - now.getTime();
  if (left <= 0) return 'expired';
  if (left < REFRESH_WHEN_DAYS_LEFT * DAY_MS) return 'refresh';
  return 'valid';
}
