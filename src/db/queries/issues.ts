import { aliasedTable, and, count, desc, eq, isNull } from 'drizzle-orm';
import type { Db } from '../client';
import { type ISSUE_KINDS, issues, media } from '../schema';

const pdf = aliasedTable(media, 'pdf');
const cover = aliasedTable(media, 'cover');

const columns = {
  id: issues.id,
  kind: issues.kind,
  title: issues.title,
  slug: issues.slug,
  description: issues.description,
  publishedOn: issues.publishedOn,
  pdfKey: pdf.key,
  pdfBytes: pdf.bytes,
  coverKey: cover.key,
  coverWidth: cover.width,
  coverHeight: cover.height,
};

export type IssueKind = (typeof ISSUE_KINDS)[number];

/** Print issues, newest first, optionally of one kind. */
export async function listIssues(
  db: Db,
  { kind, page, perPage }: { kind: IssueKind | null; page: number; perPage: number },
) {
  const where = and(isNull(issues.archivedAt), kind ? eq(issues.kind, kind) : undefined);
  const [{ total }] = await db.select({ total: count() }).from(issues).where(where);
  const rows = await db
    .select(columns)
    .from(issues)
    .innerJoin(pdf, eq(pdf.id, issues.pdfId))
    .leftJoin(cover, eq(cover.id, issues.coverId))
    .where(where)
    .orderBy(desc(issues.publishedOn), desc(issues.id))
    .limit(perPage)
    .offset((page - 1) * perPage);
  return { issues: rows, total, pages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function getIssue(db: Db, slug: string) {
  const [row] = await db
    .select(columns)
    .from(issues)
    .innerJoin(pdf, eq(pdf.id, issues.pdfId))
    .leftJoin(cover, eq(cover.id, issues.coverId))
    .where(and(eq(issues.slug, slug), isNull(issues.archivedAt)))
    .limit(1);
  return row ?? null;
}

export type Issue = NonNullable<Awaited<ReturnType<typeof getIssue>>>;
