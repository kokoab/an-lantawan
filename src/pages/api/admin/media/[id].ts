import type { APIRoute } from 'astro';
import { z } from 'zod';
import { db } from '../../../../db/client';
import { getMedia, updateMedia } from '../../../../db/queries/admin/media';
import { findPersonByName } from '../../../../db/queries/admin/staff';
import { editorOf, idParam, record } from '../../../../lib/admin';
import { readJson, reply } from '../../../../lib/api';

const body = z.object({
  alt: z.string().trim().max(300),
  caption: z.string().trim().max(500),
  credit: z.string().trim().max(120),
  focalX: z.number().min(0).max(1),
  focalY: z.number().min(0).max(1),
});

/**
 * Saves a photo's description, caption, credit and focal point from the cover photo
 * dialog. A credit that names someone on staff links to them; anything else is kept as text.
 */
export const PATCH: APIRoute = async (context) => {
  const editor = editorOf(context);
  const id = idParam(context.params.id);
  const file = id ? await getMedia(db, id) : null;
  if (!file) return reply({ ok: false, error: 'gone' }, 404);
  const input = await readJson(context.request, body);
  if (!input.ok) return input.response;
  const d = input.data;
  let creditPersonId: number | null = null;
  let creditText: string | null = d.credit || null;
  if (d.credit) {
    creditPersonId = await findPersonByName(db, d.credit);
    if (creditPersonId) creditText = null;
  }
  await updateMedia(db, file.id, {
    alt: d.alt || null,
    caption: d.caption || null,
    creditPersonId,
    creditText,
    focalX: Math.round(d.focalX * 100) / 100,
    focalY: Math.round(d.focalY * 100) / 100,
  });
  await record(editor, {
    action: 'update',
    entityType: 'media',
    entityId: file.id,
    summary: `Edited the photo ${file.key.split('/').pop()}`,
  });
  return reply({ ok: true });
};
