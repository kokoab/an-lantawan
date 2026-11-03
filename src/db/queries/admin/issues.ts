import { desc, eq, like, sql } from 'drizzle-orm';
import { slugify } from '../../../core/slug';
import type { Db } from '../../client';
import { issues, media } from '../../schema';

export type IssueInput = Pick<
  typeof issues.$inferInsert,
  'kind' | 'title' | 'slug' | 'description' | 'publishedOn' | 'pages' | 'pdfId' | 'coverId'
>;

/** Every print issue, archived ones too, newest first. */
export async function listAllIssues(db: Db) {
  return db
    .select({
      id: issues.id,
      title: issues.title,
      kind: issues.kind,
      publishedOn: issues.publishedOn,
      archivedAt: issues.archivedAt,
      coverKey: media.key,
    })
    .from(issues)
    .leftJoin(media, eq(media.id, issues.coverId))
    .orderBy(desc(issues.publishedOn), desc(issues.id));
}

export async function getIssueById(db: Db, id: number) {
  const [row] = await db.select().from(issues).where(eq(issues.id, id)).limit(1);
  return row ?? null;
}

export async function issueSlugTaken(db: Db, slug: string, exceptId: number | null) {
  const [row] = await db.select({ id: issues.id }).from(issues).where(eq(issues.slug, slug));
  return row !== undefined && row.id !== exceptId;
}

export async function createIssue(db: Db, input: IssueInput) {
  const [row] = await db.insert(issues).values(input).returning({ id: issues.id });
  return row.id;
}

export async function updateIssue(db: Db, id: number, input: IssueInput) {
  await db.update(issues).set(input).where(eq(issues.id, id));
}

export async function setIssueArchived(db: Db, id: number, archived: boolean) {
  await db
    .update(issues)
    .set({ archivedAt: archived ? sql`(unixepoch())` : null })
    .where(eq(issues.id, id));
}

/** A URL name for a new issue: its title, with a number added if it's taken. */
export async function freeIssueSlug(db: Db, title: string) {
  const base = slugify(title) || 'issue';
  const rows = await db
    .select({ slug: issues.slug })
    .from(issues)
    .where(like(issues.slug, `${base}%`));
  const taken = new Set(rows.map((r) => r.slug));
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

export async function deleteIssue(db: Db, id: number) {
  await db.delete(issues).where(eq(issues.id, id));
}
