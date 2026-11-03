import type { APIRoute } from 'astro';
import { z } from 'zod';
import { db } from '../../../../../db/client';
import { getStoryForEdit } from '../../../../../db/queries/admin/stories';
import { editorOf, idParam } from '../../../../../lib/admin';
import { readJson, reply } from '../../../../../lib/api';
import { changeStoryState } from '../../../../../lib/story-save';

const body = z.object({ intent: z.enum(['unpublish', 'archive', 'restore']) });

/** Move to drafts, archive, or bring back from the archive. */
export const POST: APIRoute = async (context) => {
  const editor = editorOf(context);
  const id = idParam(context.params.id);
  const story = id ? await getStoryForEdit(db, id) : null;
  if (!story) return reply({ ok: false, error: 'gone' }, 404);
  const input = await readJson(context.request, body);
  if (!input.ok) return input.response;
  await changeStoryState(db, story, editor, input.data.intent);
  return reply({ ok: true });
};
