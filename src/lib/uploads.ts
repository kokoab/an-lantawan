import { env } from 'cloudflare:workers';
import { imageSize } from 'image-size';
import {
  checkUpload,
  MAX_BYTES,
  type MediaKind,
  PHOTO_WIDTHS,
  pdfPageCount,
  uploadKey,
  variantKey,
  variantWidths,
} from '../core/media';
import type { Db } from '../db/client';
import { insertMedia } from '../db/queries/admin/media';

const randomPart = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 10);
};

export type Stored = Awaited<ReturnType<typeof insertMedia>>;

/**
 * Checks an uploaded file, stores it in the private R2 bucket and records it. Only signed-in
 * editors reach this; the size is checked before the whole file is read.
 */
export async function storeUpload(
  db: Db,
  file: File,
  editorId: number,
  options: { want?: MediaKind; alt?: string | null; caption?: string | null } = {},
): Promise<{ ok: true; media: Stored; pages: number | null } | { ok: false; error: string }> {
  if (file.size > MAX_BYTES.pdf)
    return { ok: false, error: 'That file is too big. Keep PDFs under 50 MB.' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkUpload(bytes, options.want);
  if (!check.ok) return check;

  let width: number | null = null;
  let height: number | null = null;
  if (check.type.kind === 'image') {
    try {
      ({ width, height } = imageSize(bytes));
    } catch {
      return { ok: false, error: 'That photo couldn’t be read. Try saving it again as a JPG.' };
    }
  }

  const key = uploadKey(file.name, check.type, new Date(), randomPart());
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: check.type.mime } });
  if (check.type.kind === 'image') await storeCopies(key, bytes, width, check.type.mime);
  const row = await insertMedia(db, {
    key,
    kind: check.type.kind,
    mime: check.type.mime,
    bytes: bytes.byteLength,
    width,
    height,
    alt: options.alt ?? null,
    caption: options.caption ?? null,
    uploadedBy: editorId,
  });
  return { ok: true, media: row, pages: check.type.kind === 'pdf' ? pdfPageCount(bytes) : null };
}

/**
 * Saves the smaller WebP copies of a photo. A copy that fails (the monthly resize allowance
 * ran out, say) is skipped: pages then fall back to the original, which always works.
 */
async function storeCopies(key: string, bytes: Uint8Array, width: number | null, mime: string) {
  await Promise.all(
    variantWidths(width, mime).map(async (w) => {
      try {
        const result = await env.IMAGES.input(new Blob([bytes as Uint8Array<ArrayBuffer>]).stream())
          .transform({ width: w, fit: 'scale-down' })
          .output({ format: 'image/webp', quality: 80 });
        const copy = await result.response().arrayBuffer();
        await env.MEDIA.put(variantKey(key, w), copy, {
          httpMetadata: { contentType: 'image/webp' },
        });
      } catch (error) {
        console.warn(`Couldn't make the ${w}px copy of ${key}`, error);
      }
    }),
  );
}

/** Removes a file and its smaller copies from R2. Its database row is deleted separately. */
export async function removeStored(key: string) {
  await env.MEDIA.delete([key, ...PHOTO_WIDTHS.map((w) => variantKey(key, w))]);
}

/**
 * The file a form's photo slot ends up with: a newly uploaded one, none if "Remove" was
 * ticked, or the one it had. A failed upload returns the reason to show beside the field.
 */
export async function resolveUpload(
  db: Db,
  slot: { name: string; current: number | null; want: MediaKind; alt?: string | null },
  form: { values: Record<string, string | string[]>; files: Record<string, File> },
  editorId: number,
): Promise<{ ok: true; id: number | null } | { ok: false; error: string }> {
  const file = form.files[slot.name];
  if (file) {
    const stored = await storeUpload(db, file, editorId, {
      want: slot.want,
      alt: slot.alt ?? null,
    });
    return stored.ok ? { ok: true, id: stored.media.id } : stored;
  }
  if (form.values[`remove_${slot.name}`] === 'on') return { ok: true, id: null };
  return { ok: true, id: slot.current };
}
