import { count, desc, eq } from 'drizzle-orm';
import type { Db } from '../../client';
import { activityLog, editors, sections, stories, sumatMessages } from '../../schema';

/** What the admin overview shows: story counts, unread Sumat, recent edits and activity. */
export async function getOverview(db: Db) {
  const [byStatus, [{ unread }], recent, activity] = await Promise.all([
    db.select({ status: stories.status, n: count() }).from(stories).groupBy(stories.status),
    db.select({ unread: count() }).from(sumatMessages).where(eq(sumatMessages.status, 'new')),
    db
      .select({
        id: stories.id,
        title: stories.title,
        status: stories.status,
        updatedAt: stories.updatedAt,
        section: sections.name,
      })
      .from(stories)
      .innerJoin(sections, eq(sections.id, stories.sectionId))
      .orderBy(desc(stories.updatedAt))
      .limit(6),
    db
      .select({ summary: activityLog.summary, at: activityLog.at, editor: editors.name })
      .from(activityLog)
      .leftJoin(editors, eq(editors.id, activityLog.editorId))
      .orderBy(desc(activityLog.at), desc(activityLog.id))
      .limit(8),
  ]);
  const counts = Object.fromEntries(byStatus.map((r) => [r.status, r.n]));
  return {
    drafts: counts.draft ?? 0,
    scheduled: counts.scheduled ?? 0,
    published: counts.published ?? 0,
    unread,
    recent,
    activity,
  };
}
