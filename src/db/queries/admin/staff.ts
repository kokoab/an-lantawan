import { and, asc, count, desc, eq, isNotNull, isNull, like, sql } from 'drizzle-orm';
import { slugify } from '../../../core/slug';
import type { Db } from '../../client';
import { media, people, staffTerms, storyAuthors } from '../../schema';

export type PersonInput = Pick<typeof people.$inferInsert, 'name' | 'slug' | 'bio' | 'photoId'>;

/** Everyone who can be credited, for pickers. Archived people are left out. */
export async function listPeopleChoices(db: Db) {
  return db
    .select({ id: people.id, name: people.name })
    .from(people)
    .where(isNull(people.archivedAt))
    .orderBy(asc(people.name));
}

/** People with their story counts, filtered by name. */
export async function listPeople(db: Db, { q, archived }: { q: string; archived: boolean }) {
  const counts = db
    .select({ personId: storyAuthors.personId, n: count().as('n') })
    .from(storyAuthors)
    .groupBy(storyAuthors.personId)
    .as('counts');
  return db
    .select({
      id: people.id,
      name: people.name,
      slug: people.slug,
      archivedAt: people.archivedAt,
      photoKey: media.key,
      stories: sql<number>`coalesce(${counts.n}, 0)`,
    })
    .from(people)
    .leftJoin(counts, eq(counts.personId, people.id))
    .leftJoin(media, eq(media.id, people.photoId))
    .where(
      and(
        archived ? isNotNull(people.archivedAt) : isNull(people.archivedAt),
        q ? like(people.name, `%${q}%`) : undefined,
      ),
    )
    .orderBy(asc(people.name));
}

export async function getPersonById(db: Db, id: number) {
  const [row] = await db.select().from(people).where(eq(people.id, id)).limit(1);
  if (!row) return null;
  const terms = await db
    .select()
    .from(staffTerms)
    .where(eq(staffTerms.personId, id))
    .orderBy(desc(staffTerms.schoolYear), asc(staffTerms.sort));
  return { ...row, terms };
}

export async function personSlugTaken(db: Db, slug: string, exceptId: number | null) {
  const [row] = await db.select({ id: people.id }).from(people).where(eq(people.slug, slug));
  return row !== undefined && row.id !== exceptId;
}

export async function createPerson(db: Db, input: PersonInput) {
  const [row] = await db.insert(people).values(input).returning({ id: people.id });
  return row.id;
}

export async function updatePerson(db: Db, id: number, input: PersonInput) {
  await db.update(people).set(input).where(eq(people.id, id));
}

export async function setPersonArchived(db: Db, id: number, archived: boolean) {
  await db
    .update(people)
    .set({ archivedAt: archived ? sql`(unixepoch())` : null })
    .where(eq(people.id, id));
}

export async function addStaffTerm(
  db: Db,
  term: Pick<typeof staffTerms.$inferInsert, 'personId' | 'schoolYear' | 'position' | 'sort'>,
) {
  await db.insert(staffTerms).values(term).onConflictDoNothing();
}

export async function removeStaffTerm(db: Db, personId: number, termId: number) {
  await db
    .delete(staffTerms)
    .where(and(eq(staffTerms.id, termId), eq(staffTerms.personId, personId)));
}

/** Every school year on the board, newest first, for the board editor's year picker. */
export async function listSchoolYears(db: Db) {
  const rows = await db
    .selectDistinct({ year: staffTerms.schoolYear })
    .from(staffTerms)
    .orderBy(desc(staffTerms.schoolYear));
  return rows.map((r) => r.year);
}

/**
 * People by the names typed in a credit field. Names already on file are matched without
 * minding case; new names become new people, so “Photo desk” can be credited too.
 */
export async function findOrCreatePeople(db: Db, names: string[]) {
  const wanted = [
    ...new Map(names.map((n) => [n.trim().toLowerCase(), n.trim().replace(/\s+/g, ' ')])).values(),
  ].filter(Boolean);
  if (!wanted.length) return new Map<string, number>();
  const rows = await db
    .select({ id: people.id, name: people.name, slug: people.slug })
    .from(people);
  const byName = new Map(rows.map((r) => [r.name.toLowerCase(), r.id]));
  const slugs = new Set(rows.map((r) => r.slug));
  for (const name of wanted) {
    if (byName.has(name.toLowerCase())) continue;
    const base = slugify(name) || 'person';
    let slug = base;
    for (let n = 2; slugs.has(slug); n++) slug = `${base}-${n}`;
    slugs.add(slug);
    const [created] = await db.insert(people).values({ name, slug }).returning({ id: people.id });
    byName.set(name.toLowerCase(), created.id);
  }
  return byName;
}

/** Someone already on file with exactly this name, ignoring case. */
export async function findPersonByName(db: Db, name: string) {
  const [row] = await db
    .select({ id: people.id })
    .from(people)
    .where(sql`lower(${people.name}) = ${name.trim().toLowerCase()}`)
    .limit(1);
  return row?.id ?? null;
}
