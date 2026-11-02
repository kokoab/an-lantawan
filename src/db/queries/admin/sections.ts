import { asc, count, eq, isNull, sql } from 'drizzle-orm';
import { type Query, runBatch } from '../../batch';
import type { Db } from '../../client';
import { redirects, sections, stories } from '../../schema';

export type SectionInput = Pick<
  typeof sections.$inferInsert,
  'name' | 'slug' | 'description' | 'parentId' | 'sort'
>;

/** Every section, archived ones too, with how many stories each holds. */
export async function listAllSections(db: Db) {
  const [rows, counts] = await Promise.all([
    db.select().from(sections).orderBy(asc(sections.sort), asc(sections.name)),
    db
      .select({ sectionId: stories.sectionId, n: count() })
      .from(stories)
      .groupBy(stories.sectionId),
  ]);
  const byId = new Map(counts.map((c) => [c.sectionId, c.n]));
  return rows.map((s) => ({ ...s, stories: byId.get(s.id) ?? 0 }));
}

export async function getSectionById(db: Db, id: number) {
  const [row] = await db.select().from(sections).where(eq(sections.id, id)).limit(1);
  return row ?? null;
}

export async function slugTaken(db: Db, slug: string, exceptId: number | null) {
  const [row] = await db.select({ id: sections.id }).from(sections).where(eq(sections.slug, slug));
  return row !== undefined && row.id !== exceptId;
}

export async function createSection(db: Db, input: SectionInput) {
  const [row] = await db.insert(sections).values(input).returning({ id: sections.id });
  return row.id;
}

/**
 * Saves a section. When its URL name changes, the old address keeps working: story pages
 * look up `/old-name` and follow it to the new one.
 */
export async function updateSection(db: Db, id: number, input: SectionInput, oldSlug: string) {
  const queries: Query[] = [db.update(sections).set(input).where(eq(sections.id, id))];
  if (input.slug && input.slug !== oldSlug) {
    const to = `/${input.slug}`;
    queries.push(
      // The new address is live now, so nothing may redirect away from it.
      db.delete(redirects).where(eq(redirects.fromPath, to)),
      db
        .insert(redirects)
        .values({ fromPath: `/${oldSlug}`, toPath: to })
        .onConflictDoUpdate({ target: redirects.fromPath, set: { toPath: to } }),
      // Older names of this section now lead straight to the new one.
      db
        .update(redirects)
        .set({ toPath: to })
        .where(eq(redirects.toPath, `/${oldSlug}`)),
    );
  }
  await runBatch(db, queries);
}

export async function setSectionArchived(db: Db, id: number, archived: boolean) {
  await db
    .update(sections)
    .set({ archivedAt: archived ? sql`(unixepoch())` : null })
    .where(eq(sections.id, id));
}

/** Live top-level sections, for parent pickers. */
export async function listParentChoices(db: Db) {
  return db
    .select({ id: sections.id, name: sections.name })
    .from(sections)
    .where(isNull(sections.parentId))
    .orderBy(asc(sections.sort));
}
