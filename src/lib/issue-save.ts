import { parseForm } from '../core/forms';
import type { Db } from '../db/client';
import {
  createIssue,
  type IssueInput,
  issueSlugTaken,
  updateIssue,
} from '../db/queries/admin/issues';
import type { SignedInEditor } from '../db/queries/auth';
import { record } from './admin';
import { issueForm } from './admin-schemas';
import { resolveUpload } from './uploads';

type Form = { values: Record<string, string | string[]>; files: Record<string, File> };

/** Checks and saves a print issue form, for both adding and editing. */
export async function saveIssue(
  db: Db,
  form: Form,
  editor: SignedInEditor,
  existing: { id: number; pdfId: number; coverId: number | null } | null,
): Promise<{ ok: true; id: number } | { ok: false; errors: Record<string, string> }> {
  const parsed = parseForm(issueForm, form.values);
  if (!parsed.ok) return parsed;
  if (await issueSlugTaken(db, parsed.data.slug, existing?.id ?? null)) {
    return { ok: false, errors: { slug: 'Another issue uses this URL name.' } };
  }
  const pdf = await resolveUpload(
    db,
    { name: 'pdf', current: existing?.pdfId ?? null, want: 'pdf' },
    form,
    editor.id,
  );
  if (!pdf.ok) return { ok: false, errors: { pdf: pdf.error } };
  if (pdf.id === null) return { ok: false, errors: { pdf: 'Upload the PDF of the issue.' } };
  const cover = await resolveUpload(
    db,
    {
      name: 'cover',
      current: existing?.coverId ?? null,
      want: 'image',
      alt: `Cover of ${parsed.data.title}`,
    },
    form,
    editor.id,
  );
  if (!cover.ok) return { ok: false, errors: { cover: cover.error } };

  const input: IssueInput = { ...parsed.data, pdfId: pdf.id, coverId: cover.id };
  const id = existing ? existing.id : await createIssue(db, input);
  if (existing) await updateIssue(db, existing.id, input);
  await record(editor, {
    action: existing ? 'update' : 'create',
    entityType: 'issue',
    entityId: id,
    summary: `${existing ? 'Edited' : 'Added'} the print issue ${parsed.data.title}`,
  });
  return { ok: true, id };
}
