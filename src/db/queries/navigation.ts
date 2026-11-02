import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Db } from '../client';
import { MENU_GROUPS, menuItems, sections, sportsfests } from '../schema';

export interface NavLink {
  label: string;
  href: string;
  /** Section slug, so the header can mark the current section. */
  sectionSlug: string | null;
}

export type Navigation = Record<(typeof MENU_GROUPS)[number], NavLink[]>;

/** Every editable link group: header, menu panel and footer. */
export async function getNavigation(db: Db): Promise<Navigation> {
  const rows = await db
    .select({
      group: menuItems.group,
      label: menuItems.label,
      href: menuItems.href,
      sectionSlug: sections.slug,
    })
    .from(menuItems)
    .leftJoin(sections, and(eq(sections.id, menuItems.sectionId), isNull(sections.archivedAt)))
    .orderBy(menuItems.group, menuItems.sort);

  const nav = Object.fromEntries(MENU_GROUPS.map((g) => [g, [] as NavLink[]])) as Navigation;
  for (const r of rows) {
    const href = r.sectionSlug ? `/${r.sectionSlug}` : r.href;
    if (!href) continue;
    nav[r.group].push({ label: r.label, href, sectionSlug: r.sectionSlug });
  }
  return nav;
}

/** The newest Sportsfest, used for the menu's Sportsfest group and its "Ongoing" tag. */
export async function getCurrentSportsfest(db: Db) {
  const [row] = await db
    .select({ year: sportsfests.year, name: sportsfests.name, status: sportsfests.status })
    .from(sportsfests)
    .orderBy(desc(sportsfests.year))
    .limit(1);
  return row ?? null;
}
