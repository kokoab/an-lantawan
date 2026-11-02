import { slugify } from './slug';

/** Upload rules: which files the admin accepts, how big, and where they're stored in R2. */

export const MAX_BYTES = { image: 10 * 1024 * 1024, pdf: 50 * 1024 * 1024 } as const;

export type MediaKind = keyof typeof MAX_BYTES;
export interface FileType {
  kind: MediaKind;
  mime: string;
  ext: string;
}

const startsWith = (bytes: Uint8Array, sig: number[], offset = 0) =>
  sig.every((b, i) => bytes[offset + i] === b);

/**
 * What a file really is, from its first bytes rather than its name or the browser's claim.
 * SVG and HTML are refused: they can carry scripts.
 */
export function sniff(bytes: Uint8Array): FileType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff]))
    return { kind: 'image', mime: 'image/jpeg', ext: 'jpg' };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { kind: 'image', mime: 'image/png', ext: 'png' };
  }
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38]))
    return { kind: 'image', mime: 'image/gif', ext: 'gif' };
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return { kind: 'image', mime: 'image/webp', ext: 'webp' };
  }
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]))
    return { kind: 'pdf', mime: 'application/pdf', ext: 'pdf' };
  return null;
}

export type UploadCheck = { ok: true; type: FileType } | { ok: false; error: string };

const mb = (n: number) => `${Math.round(n / (1024 * 1024))} MB`;

/** Whether an upload is allowed: a known type, not empty, and under its size limit. */
export function checkUpload(bytes: Uint8Array, want?: MediaKind): UploadCheck {
  if (bytes.byteLength === 0) return { ok: false, error: 'That file is empty.' };
  const type = sniff(bytes);
  if (!type) return { ok: false, error: 'Upload a JPG, PNG, WebP or GIF photo, or a PDF.' };
  if (want && type.kind !== want) {
    return { ok: false, error: want === 'pdf' ? 'Upload a PDF here.' : 'Upload a photo here.' };
  }
  if (bytes.byteLength > MAX_BYTES[type.kind]) {
    return {
      ok: false,
      error: `Keep ${type.kind === 'pdf' ? 'PDFs' : 'photos'} under ${mb(MAX_BYTES[type.kind])}.`,
    };
  }
  return { ok: true, type };
}

/**
 * The R2 key for an upload: dated folders and a random part, so names never clash and a
 * replaced file never reuses a cached URL. The readable part comes from the file name.
 */
export function uploadKey(fileName: string, type: FileType, now: Date, random: string) {
  const base = slugify(fileName.replace(/\.[a-z0-9]{2,5}$/i, '')).slice(0, 60) || 'file';
  const month = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return `uploads/${month}/${random}-${base}.${type.ext}`;
}
