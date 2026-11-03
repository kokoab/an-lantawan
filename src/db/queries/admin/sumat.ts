import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { type Doc, emptyDoc } from '../../../core/content/doc';
import { runBatch } from '../../batch';
import type { Db } from '../../client';
import { sections, stories, sumatMessages, sumatPrompts } from '../../schema';

export type MessageStatus = (typeof sumatMessages.$inferSelect)['status'];

/** Messages in one inbox tab, newest first, with how many each tab holds. */
export async function listMessages(
  db: Db,
  { status, page, perPage }: { status: MessageStatus; page: number; perPage: number },
) {
  const [counts, rows] = await Promise.all([
    db
      .select({ status: sumatMessages.status, n: count() })
      .from(sumatMessages)
      .groupBy(sumatMessages.status),
    db
      .select()
      .from(sumatMessages)
      .where(eq(sumatMessages.status, status))
      .orderBy(desc(sumatMessages.receivedAt), desc(sumatMessages.id))
      .limit(perPage)
      .offset((page - 1) * perPage),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c.n])) as Partial<
    Record<MessageStatus, number>
  >;
  const total = byStatus[status] ?? 0;
  return { rows, counts: byStatus, pages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function getMessage(db: Db, id: number) {
  const [message] = await db.select().from(sumatMessages).where(eq(sumatMessages.id, id)).limit(1);
  if (!message) return null;
  const [letter] = await db
    .select({
      id: stories.id,
      status: stories.status,
      slug: stories.slug,
      sectionSlug: sections.slug,
    })
    .from(stories)
    .innerJoin(sections, eq(sections.id, stories.sectionId))
    .where(eq(stories.sourceMessageId, id))
    .limit(1);
  return { ...message, letter: letter ?? null };
}

export async function setMessageStatus(db: Db, id: number, status: MessageStatus) {
  await db.update(sumatMessages).set({ status }).where(eq(sumatMessages.id, id));
}

export async function setMessageNotes(db: Db, id: number, notes: string | null) {
  await db.update(sumatMessages).set({ notes }).where(eq(sumatMessages.id, id));
}

/** Sets the status of several messages at once. */
export async function setStatuses(db: Db, ids: number[], status: MessageStatus) {
  if (ids.length)
    await db.update(sumatMessages).set({ status }).where(inArray(sumatMessages.id, ids));
}

/** The statuses of messages before a change, for undo. */
export async function statusesOf(db: Db, ids: number[]) {
  if (!ids.length) return [];
  return db
    .select({ id: sumatMessages.id, status: sumatMessages.status })
    .from(sumatMessages)
    .where(inArray(sumatMessages.id, ids));
}

/** Opens Sumat again with the newest prompt, or with a new one. */
export async function openSumat(db: Db, text: string) {
  const [latest] = await db
    .select()
    .from(sumatPrompts)
    .orderBy(desc(sumatPrompts.opensAt), desc(sumatPrompts.id))
    .limit(1);
  if (latest && latest.text === text) {
    await db
      .update(sumatPrompts)
      .set({ closesAt: null, opensAt: sql`min(${sumatPrompts.opensAt}, unixepoch())` })
      .where(eq(sumatPrompts.id, latest.id));
  } else {
    await createPrompt(db, { text, opensAt: new Date(), closesAt: null });
  }
}

/** Publishes a message as a letter: a story of kind "letter" linked back to the message. */
export async function publishLetter(
  db: Db,
  message: { id: number },
  letter: {
    text: string;
    signature: string;
    sectionId: number;
    slug: string;
    publishedAt: Date;
    body?: Doc;
  },
) {
  const [story] = await db
    .insert(stories)
    .values({
      kind: 'letter',
      status: letter.publishedAt > new Date() ? 'scheduled' : 'published',
      sectionId: letter.sectionId,
      title: letter.text,
      slug: letter.slug,
      dek: letter.signature,
      body: letter.body ?? emptyDoc(),
      publishedAt: letter.publishedAt,
      sourceMessageId: message.id,
    })
    .returning({ id: stories.id });
  await setMessageStatus(db, message.id, 'published');
  return story.id;
}

export async function listPrompts(db: Db) {
  const [prompts, counts] = await Promise.all([
    db.select().from(sumatPrompts).orderBy(desc(sumatPrompts.opensAt), desc(sumatPrompts.id)),
    db
      .select({ promptId: sumatMessages.promptId, n: count() })
      .from(sumatMessages)
      .groupBy(sumatMessages.promptId),
  ]);
  const byId = new Map(counts.map((c) => [c.promptId, c.n]));
  return prompts.map((p) => ({ ...p, messages: byId.get(p.id) ?? 0 }));
}

export async function createPrompt(
  db: Db,
  p: { text: string; opensAt: Date; closesAt: Date | null },
) {
  const [row] = await db.insert(sumatPrompts).values(p).returning({ id: sumatPrompts.id });
  return row.id;
}

export async function updatePrompt(
  db: Db,
  id: number,
  p: { text: string; opensAt: Date; closesAt: Date | null },
) {
  await db.update(sumatPrompts).set(p).where(eq(sumatPrompts.id, id));
}

/** Closes every open prompt now, which closes Sumat. */
export async function closeOpenPrompts(db: Db) {
  await runBatch(db, [
    db
      .update(sumatPrompts)
      .set({ closesAt: sql`(unixepoch())` })
      .where(
        and(
          sql`${sumatPrompts.opensAt} <= unixepoch()`,
          sql`(${sumatPrompts.closesAt} is null or ${sumatPrompts.closesAt} > unixepoch())`,
        ),
      ),
  ]);
}
