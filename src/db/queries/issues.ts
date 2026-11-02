import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { Db } from '../client';
import { type ISSUE_KINDS, issues, media } from '../schema';

export type IssueKind = (typeof ISSUE_KINDS)[number];

export interface Issue {
  id: number;
  kind: IssueKind;
  title: string;
  slug: string;
  description: string | null;
  publishedOn: string;
  pdfKey: string;
  pdfBytes: number;
  coverKey: string | null;
}

type IssueRow = typeof issues.$inferSelect;

/** Attaches each issue's PDF and cover files, fetched in one query. */
async function withFiles(db: Db, rows: IssueRow[]): Promise<Issue[]> {
  const ids = [
    ...new Set(rows.flatMap((r) => [r.pdfId, r.coverId]).filter((id): id is number => id !== null)),
  ];
  const files = ids.length
    ? await db
        .select({ id: media.id, key: media.key, bytes: media.bytes })
        .from(media)
        .where(inArray(media.id, ids))
    : [];
  const byId = new Map(files.map((f) => [f.id, f]));
  return rows.flatMap((r) => {
    const pdf = byId.get(r.pdfId);
    if (!pdf) return [];
    return [
      {
        id: r.id,
        kind: r.kind,
        title: r.title,
        slug: r.slug,
        description: r.description,
        publishedOn: r.publishedOn,
        pdfKey: pdf.key,
        pdfBytes: pdf.bytes,
        coverKey: r.coverId ? (byId.get(r.coverId)?.key ?? null) : null,
      },
    ];
  });
}

/** Print issues, newest first, optionally of one kind. Returns the total for paging. */
export async function listIssues(
  db: Db,
  { kind, offset, limit }: { kind: IssueKind | null; offset: number; limit: number },
) {
  const where = and(isNull(issues.archivedAt), kind ? eq(issues.kind, kind) : undefined);
  const [{ total }] = await db.select({ total: count() }).from(issues).where(where);
  const rows = await db
    .select()
    .from(issues)
    .where(where)
    .orderBy(desc(issues.publishedOn), desc(issues.id))
    .limit(limit)
    .offset(offset);
  return { issues: await withFiles(db, rows), total };
}

export async function getIssue(db: Db, slug: string): Promise<Issue | null> {
  const rows = await db
    .select()
    .from(issues)
    .where(and(eq(issues.slug, slug), isNull(issues.archivedAt)))
    .limit(1);
  const [issue] = await withFiles(db, rows);
  return issue ?? null;
}
