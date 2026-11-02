import type { APIRoute } from 'astro';
import { optionalText } from '../../../core/forms';
import { parsePage } from '../../../core/paging';
import { db } from '../../../db/client';
import { listMedia } from '../../../db/queries/admin/media';
import { editorOf, record } from '../../../lib/admin';
import { storeUpload } from '../../../lib/uploads';

/** Photos for the story editor's picker. Signed-in editors only (see the middleware). */
export const GET: APIRoute = async ({ url }) => {
  const kind = url.searchParams.get('kind') === 'pdf' ? 'pdf' : 'image';
  const page = parsePage(url.searchParams.get('page')) ?? 1;
  const q = (url.searchParams.get('q') ?? '').slice(0, 100);
  const { rows, pages } = await listMedia(db, { kind, q, page, perPage: 24 });
  return Response.json({
    ok: true,
    pages,
    items: rows.map((m) => ({
      id: m.id,
      key: m.key,
      alt: m.alt ?? '',
      caption: m.caption ?? '',
      width: m.width,
      height: m.height,
    })),
  });
};

/** Uploads one photo from the story editor. */
export const POST: APIRoute = async (context) => {
  const editor = editorOf(context);
  const form = await context.request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return Response.json({ ok: false, error: 'Choose a photo to upload.' }, { status: 400 });
  }
  const alt = optionalText(300).safeParse(String(form?.get('alt') ?? ''));
  const stored = await storeUpload(db, file, editor.id, {
    want: 'image',
    alt: alt.success ? alt.data : null,
  });
  if (!stored.ok) return Response.json({ ok: false, error: stored.error }, { status: 422 });
  await record(editor, {
    action: 'upload',
    entityType: 'media',
    entityId: stored.media.id,
    summary: `Uploaded ${stored.media.key.split('/').pop()}`,
  });
  const m = stored.media;
  return Response.json({
    ok: true,
    item: {
      id: m.id,
      key: m.key,
      alt: m.alt ?? '',
      caption: m.caption ?? '',
      width: m.width,
      height: m.height,
    },
  });
};
