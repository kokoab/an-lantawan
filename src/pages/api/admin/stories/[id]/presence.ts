import type { APIRoute } from 'astro';
import { db } from '../../../../../db/client';
import { leavePresence, touchPresence } from '../../../../../db/queries/admin/stories';
import { editorOf, idParam } from '../../../../../lib/admin';
import { reply } from '../../../../../lib/api';

/** Says this person has the story open, and returns who else does. Sent every 30 seconds. */
export const POST: APIRoute = async (context) => {
  const editor = editorOf(context);
  const id = idParam(context.params.id);
  if (!id || !editor.person) return reply({ ok: true, others: [] });
  const others = await touchPresence(db, id, editor.person.id);
  return reply({ ok: true, others });
};

/** Sent when the editor closes the story. */
export const DELETE: APIRoute = async (context) => {
  const editor = editorOf(context);
  const id = idParam(context.params.id);
  if (id && editor.person) await leavePresence(db, id, editor.person.id);
  return reply({ ok: true });
};
