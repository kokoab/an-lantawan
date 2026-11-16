import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { isPhotoWidth, variantKey } from '../../core/media';

const YEAR = 60 * 60 * 24 * 365;
const DAY = 60 * 60 * 24;

/** Types by extension, for files stored before R2 kept their type. */
const TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

/**
 * Serves uploaded photos and PDFs from R2. Keys never change once uploaded, so responses
 * are cached for a year. `?w=480|960|1600` asks for a photo's smaller WebP copy; a photo
 * without one gets its original, cached for a day so a copy made later is picked up.
 * Only the bucket's two folders are served: uploads/ (from the admin) and wp/ (imported
 * from the old WordPress site).
 */
export const GET: APIRoute = async ({ params, request, url, locals }) => {
  const key = params.key ?? '';
  if (!/^(uploads|wp)\//.test(key) || key.includes('..')) {
    return new Response('Not found', { status: 404 });
  }
  // Workers' default edge cache; the DOM types used by Astro don't know about it.
  const cache = (caches as unknown as { default: Cache }).default;
  const cached = await cache.match(request);
  if (cached) return cached;

  const w = Number(url.searchParams.get('w'));
  const copy = isPhotoWidth(w) ? await env.MEDIA.get(variantKey(key, w)) : null;
  const object = copy ?? (await env.MEDIA.get(key));
  if (!object) return new Response('Not found', { status: 404 });

  const ext = (copy ? 'webp' : (key.split('.').pop() ?? '')).toLowerCase();
  const fallback = isPhotoWidth(w) && !copy;
  const response = new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? TYPES[ext] ?? 'application/octet-stream',
      'Cache-Control': fallback ? `public, max-age=${DAY}` : `public, max-age=${YEAR}, immutable`,
      ETag: object.httpEtag,
      'X-Content-Type-Options': 'nosniff',
    },
  });
  locals.cfContext?.waitUntil(cache.put(request, response.clone()));
  return response;
};
