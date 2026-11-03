import type { APIRoute } from 'astro';
import { db } from '../../../../db/client';
import { editorOf } from '../../../../lib/admin';
import { storyPayload } from '../../../../lib/admin-schemas';
import { readJson, reply } from '../../../../lib/api';
import { saveStoryPayload } from '../../../../lib/story-save';

/** Creates a draft the first time the editor autosaves a new story. */
export const POST: APIRoute = async (context) => {
  const editor = editorOf(context);
  const input = await readJson(context.request, storyPayload);
  if (!input.ok) return input.response;
  const saved = await saveStoryPayload(db, input.data, editor, null);
  return saved.ok ? reply(saved) : reply(saved, 422);
};
