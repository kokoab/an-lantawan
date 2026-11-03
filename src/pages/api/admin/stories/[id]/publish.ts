import type { APIRoute } from 'astro';
import { z } from 'zod';
import { db } from '../../../../../db/client';
import { getStoryForEdit } from '../../../../../db/queries/admin/stories';
import { editorOf, idParam } from '../../../../../lib/admin';
import { readJson, reply } from '../../../../../lib/api';
import { checksFor, publishStory } from '../../../../../lib/story-save';

/** “Before you publish”: what is ready and what still needs fixing, for the saved story. */
export const GET: APIRoute = async ({ params }) => {
  const id = idParam(params.id);
  const story = id ? await getStoryForEdit(db, id) : null;
  if (!story) return reply({ ok: false, error: 'gone' }, 404);
  return reply({ ok: true, checks: await checksFor(db, story) });
};

const body = z.object({ at: z.string().datetime().nullable() });

/** Publishes now, or schedules for `at`. */
export const POST: APIRoute = async (context) => {
  const editor = editorOf(context);
  const id = idParam(context.params.id);
  const story = id ? await getStoryForEdit(db, id) : null;
  if (!story) return reply({ ok: false, error: 'gone' }, 404);
  const input = await readJson(context.request, body);
  if (!input.ok) return input.response;
  const at = input.data.at ? new Date(input.data.at) : null;
  const done = await publishStory(db, story, editor, at);
  return done.ok
    ? reply({ ok: true, status: done.status })
    : reply({ ok: false, checks: done.checks }, 422);
};
