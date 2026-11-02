/**
 * True if this visitor is under the limit. Keyed by IP address, which the limiter keeps
 * in memory only. Fails open if the limiter itself errors, so a Cloudflare hiccup
 * doesn't lock everyone out.
 */
export async function underLimit(limiter: RateLimit, request: Request, scope: string) {
  const ip = request.headers.get('cf-connecting-ip') ?? 'local';
  try {
    const { success } = await limiter.limit({ key: `${scope}:${ip}` });
    return success;
  } catch (err) {
    console.error('Rate limiter failed', err);
    return true;
  }
}
