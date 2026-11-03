import type { APIRoute } from 'astro';
import { db } from '../../../../../db/client';
import { getStoryForEdit } from '../../../../../db/queries/admin/stories';
import { editorOf, idParam } from '../../../../../lib/admin';
import { storyPayload } from '../../../../../lib/admin-schemas';
import { readJson, reply } from '../../../../../lib/api';
import { saveStoryPayload } from '../../../../../lib/story-save';

/** Saves the story: every autosave of a draft, and Update on a live story. */
export const PUT: APIRoute = async (context) => {
  const editor = editorOf(context);
  const id = idParam(context.params.id);
  const story = id ? await getStoryForEdit(db, id) : null;
  if (!story) return reply({ ok: false, error: 'gone' }, 404);
  const input = await readJson(context.request, storyPayload);
  if (!input.ok) return input.response;
  const saved = await saveStoryPayload(db, input.data, editor, story);
  if (saved.ok) return reply({ ...saved, by: editor.person?.name ?? null });
  return reply(saved, saved.conflict ? 409 : 422);
};
