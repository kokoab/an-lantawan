/**
 * Sent with every response. Pages also get a full Content-Security-Policy from Astro
 * (see astro.config.mjs); responses without one get FALLBACK_CSP.
 */
export const SECURITY_HEADERS: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

export const FALLBACK_CSP = "default-src 'none'; frame-ancestors 'none'";
