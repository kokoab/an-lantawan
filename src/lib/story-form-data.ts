import type { Db } from '../db/client';
import { getMediaByIds } from '../db/queries/admin/media';
import { listPeopleChoices } from '../db/queries/admin/people';
import { listAllSections } from '../db/queries/admin/sections';
import { listEventChoices } from '../db/queries/admin/stories';

/** The choices every story form needs: sections, people to credit and Sportsfest events. */
export async function storyFormChoices(db: Db) {
  const [sections, people, events] = await Promise.all([
    listAllSections(db),
    listPeopleChoices(db),
    listEventChoices(db),
  ]);
  return { sections: sections.filter((s) => !s.archivedAt), people, events };
}

/** Rebuilds the credit rows from a submitted form, to show them again after an error. */
export function creditsFromForm(values: Record<string, string | string[]>) {
  const list = (n: string) => {
    const v = values[n];
    return v === undefined ? [] : Array.isArray(v) ? v : [v];
  };
  const roles = list('creditRole');
  return list('creditPerson')
    .map((personId, i) => ({ personId, role: roles[i] ?? 'writer' }))
    .filter((c) => c.personId);
}

export const formList = (values: Record<string, string | string[]>, name: string) => {
  const v = values[name];
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
};

/** The cover photo chosen in a submitted form, to show it again after an error. */
export async function coverFromForm(db: Db, values: Record<string, string | string[]>) {
  const id = Number(formList(values, 'coverId')[0]);
  if (!Number.isInteger(id) || id <= 0) return null;
  const [m] = await getMediaByIds(db, [id]);
  return m ? { id: m.id, key: m.key, alt: m.alt ?? '' } : null;
}
