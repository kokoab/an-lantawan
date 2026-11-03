import { parseForm } from '../core/forms';
import type { Db } from '../db/client';
import {
  createIssue,
  deleteIssue,
  freeIssueSlug,
  type IssueInput,
  updateIssue,
} from '../db/queries/admin/issues';
import { deleteMedia, getMedia, mediaUsage } from '../db/queries/admin/media';
import type { SignedInEditor } from '../db/queries/auth';
import type { issues } from '../db/schema';
import { record } from './admin';
import { printIssueForm } from './admin-schemas';
import { removeStored, resolveUpload, storeUpload } from './uploads';

type Form = { values: Record<string, string | string[]>; files: Record<string, File> };
type Existing = typeof issues.$inferSelect;

/**
 * Checks and saves a print issue, for both adding and editing. The PDF usually arrives
 * already uploaded (its ID in `pdfId`, sent while the form was filled in); a PDF attached
 * to the form itself works too, for browsers without scripts.
 */
export async function saveIssue(
  db: Db,
  form: Form,
  editor: SignedInEditor,
  existing: Existing | null,
): Promise<{ ok: true; id: number } | { ok: false; errors: Record<string, string> }> {
  const parsed = parseForm(printIssueForm, form.values);
  if (!parsed.ok) return parsed;
  const d = parsed.data;

  let pdfId = existing?.pdfId ?? null;
  let pages = d.pages;
  if (d.pdfId) {
    const uploaded = await getMedia(db, d.pdfId);
    if (uploaded?.kind !== 'pdf') return { ok: false, errors: { pdf: 'Upload the PDF again.' } };
    pdfId = uploaded.id;
  } else if (form.files.pdf) {
    const stored = await storeUpload(db, form.files.pdf, editor.id, { want: 'pdf' });
    if (!stored.ok) return { ok: false, errors: { pdf: stored.error } };
    pdfId = stored.media.id;
    pages ??= stored.pages;
  }
  if (pdfId === null) return { ok: false, errors: { pdf: 'Upload the PDF of the issue.' } };

  const cover = await resolveUpload(
    db,
    {
      name: 'cover',
      current: existing?.coverId ?? null,
      want: 'image',
      alt: `Cover of ${d.title}`,
    },
    form,
    editor.id,
  );
  if (!cover.ok) return { ok: false, errors: { cover: cover.error } };

  const input: IssueInput = {
    title: d.title,
    kind: d.kind,
    description: d.description,
    publishedOn: `${d.month}-01`,
    pages,
    slug: existing?.slug ?? (await freeIssueSlug(db, d.title)),
    pdfId,
    coverId: cover.id,
  };
  const id = existing ? existing.id : await createIssue(db, input);
  if (existing) await updateIssue(db, existing.id, input);
  await record(editor, {
    action: existing ? 'update' : 'create',
    entityType: 'issue',
    entityId: id,
    summary: `${existing ? 'Edited' : 'Added'} the print issue ${d.title}`,
  });
  return { ok: true, id };
}

/** Deletes an issue, and its PDF and cover too unless something else still uses them. */
export async function removeIssue(db: Db, issue: Existing, editor: SignedInEditor) {
  await deleteIssue(db, issue.id);
  for (const fileId of [issue.pdfId, issue.coverId]) {
    if (fileId === null) continue;
    const use = await mediaUsage(db, fileId);
    if (use.stories.length || use.issues.length || use.people.length || use.tribus.length) continue;
    const file = await getMedia(db, fileId);
    if (!file) continue;
    await deleteMedia(db, file.id);
    await removeStored(file.key);
  }
  await record(editor, {
    action: 'delete',
    entityType: 'issue',
    entityId: issue.id,
    summary: `Deleted the print issue ${issue.title}`,
  });
}
