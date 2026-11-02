import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { media } from '../../db/schema';

const YEAR = 60 * 60 * 24 * 365;

/**
 * Serves uploaded photos and PDFs from R2. Keys never change once uploaded, so responses
 * are cached at Cloudflare's edge for a year and most requests never reach R2. Keys that
 * aren't in the database are refused before touching R2.
 */
export const GET: APIRoute = async ({ params, request, locals }) => {
  const key = params.key ?? '';
  // Workers' default edge cache; the DOM types used by Astro don't know about it.
  const cache = (caches as unknown as { default: Cache }).default;
  const cached = await cache.match(request);
  if (cached) return cached;

  const [row] = await db
    .select({ mime: media.mime })
    .from(media)
    .where(eq(media.key, key))
    .limit(1);
  if (!row) return new Response('Not found', { status: 404 });

  const object = await env.MEDIA.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const response = new Response(object.body, {
    headers: {
      'Content-Type': row.mime,
      'Cache-Control': `public, max-age=${YEAR}, immutable`,
      ETag: object.httpEtag,
      'X-Content-Type-Options': 'nosniff',
    },
  });
  locals.cfContext?.waitUntil(cache.put(request, response.clone()));
  return response;
};
