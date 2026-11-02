import type { AstroGlobal } from 'astro';
import type { FormValues } from '../core/forms';
import { db } from '../db/client';
import { type Activity, logActivity } from '../db/queries/activity';
import type { SignedInEditor } from '../db/queries/auth';

/** The signed-in editor. The middleware turns everyone else away before a page runs. */
export function editorOf(astro: Pick<AstroGlobal, 'locals'>): SignedInEditor {
  const editor = astro.locals.editor;
  if (!editor) throw new Error('Admin page reached without an editor');
  return editor;
}

/** A submitted form as plain values; repeated fields become lists. */
export async function readForm(request: Request): Promise<FormValues> {
  const data = await request.formData();
  const out: FormValues = {};
  for (const [name, value] of data) {
    if (typeof value !== 'string') continue;
    const prev = out[name];
    out[name] = prev === undefined ? value : Array.isArray(prev) ? [...prev, value] : [prev, value];
  }
  return out;
}

/** A submitted form that may carry files: text values plus each non-empty file by name. */
export async function readFormWithFiles(request: Request) {
  const data = await request.formData();
  const values: FormValues = {};
  const files: Record<string, File> = {};
  for (const [name, value] of data) {
    if (typeof value !== 'string') {
      if (value.size > 0) files[name] = value;
      continue;
    }
    const prev = values[name];
    values[name] =
      prev === undefined ? value : Array.isArray(prev) ? [...prev, value] : [prev, value];
  }
  return { values, files };
}

/** The single value of a field, for reading which button was pressed. */
export const one = (values: FormValues, name: string) => {
  const v = values[name];
  return (Array.isArray(v) ? v[0] : v) ?? '';
};

/**
 * Notices shown after a change. Pages redirect with `?done=<code>` and the layout shows the
 * matching sentence; anything else in the URL is ignored.
 */
export const DONE = {
  saved: 'Saved.',
  created: 'Added.',
  archived: 'Archived. It no longer shows on the site.',
  restored: 'Restored.',
  published: 'Published. It is live on the site.',
  unpublished: 'Moved back to drafts.',
  scheduled: 'Scheduled.',
  deleted: 'Deleted.',
  uploaded: 'Uploaded.',
  pinned: 'Pinned to the top of the homepage.',
  unpinned: 'Unpinned. The homepage leads with the newest story.',
  generated: 'Bracket created.',
  result: 'Result saved.',
  cleared: 'Result cleared.',
  moved: 'Order saved.',
} as const;
export type DoneCode = keyof typeof DONE;

export const doneMessage = (url: URL) => {
  const code = url.searchParams.get('done');
  return code && code in DONE ? DONE[code as DoneCode] : null;
};

/** Back to a page with a notice, after a change (post, redirect, get). */
export const doneRedirect = (astro: Pick<AstroGlobal, 'redirect'>, path: string, code: DoneCode) =>
  astro.redirect(`${path}${path.includes('?') ? '&' : '?'}done=${code}`, 303);

/** Records who changed what. Failing to log never blocks the change itself. */
export async function record(editor: SignedInEditor, a: Omit<Activity, 'editorId'>) {
  try {
    await logActivity(db, { ...a, editorId: editor.id });
  } catch (e) {
    console.error('activity log failed', e);
  }
}

/** A positive whole number from a route parameter, or null. */
export const idParam = (value: string | undefined) => {
  const n = Number(value);
  return value && /^\d{1,9}$/.test(value) && n > 0 ? n : null;
};
