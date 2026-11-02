import { optionalId, optionalLink } from './forms';

/** The menus editors can change, where each one shows, and how many links it can hold. */
export const EDITABLE_MENUS = [
  { group: 'header', label: 'Top bar', note: 'The links across the top of every page.', max: 7 },
  {
    group: 'sections',
    label: 'Sections',
    note: 'The big links in the Menu panel and the footer.',
    max: 10,
  },
  { group: 'publication', label: 'Publication', note: 'Menu panel and footer.', max: 10 },
  { group: 'write', label: 'Write to us', note: 'Menu panel and footer.', max: 6 },
] as const;

export type MenuGroup = (typeof EDITABLE_MENUS)[number]['group'];

export interface MenuRow {
  label: string;
  sectionId: number | null;
  href: string | null;
}

/**
 * Reads a menu's rows from parallel form lists. A row links to a section or to a path or
 * https link; rows with no label and no link are dropped. Errors name the row by number.
 */
export function readMenuRows(
  labels: string[],
  sections: string[],
  hrefs: string[],
  max: number,
): { ok: true; rows: MenuRow[] } | { ok: false; error: string } {
  const rows: MenuRow[] = [];
  const count = Math.max(labels.length, sections.length, hrefs.length);
  for (let i = 0; i < count; i++) {
    const label = (labels[i] ?? '').trim();
    const section = optionalId.safeParse(sections[i] ?? '');
    const href = optionalLink.safeParse(hrefs[i] ?? '');
    const n = i + 1;
    if (!section.success) return { ok: false, error: `Link ${n}: choose a section from the list.` };
    if (!href.success) return { ok: false, error: `Link ${n}: ${href.error.issues[0]?.message}` };
    if (!label && section.data === null && href.data === null) continue;
    if (!label) return { ok: false, error: `Link ${n}: give it a label.` };
    if (label.length > 40)
      return { ok: false, error: `Link ${n}: keep the label under 40 characters.` };
    if (section.data === null && href.data === null) {
      return { ok: false, error: `Link ${n}: choose a section or type where it goes.` };
    }
    rows.push({ label, sectionId: section.data, href: section.data === null ? href.data : null });
  }
  if (rows.length > max) return { ok: false, error: `Keep this menu to ${max} links.` };
  return { ok: true, rows };
}
