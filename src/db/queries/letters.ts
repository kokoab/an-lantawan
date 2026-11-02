import { and, count, desc, eq, type SQL } from 'drizzle-orm';
import type { Db } from '../client';
import { sections, stories, sumatMessages } from '../schema';
import { liveStory } from './live';

export type LetterFilter = 'all' | 'anonymous' | 'signed';

/**
 * Published letters, newest first. A letter is a story of kind "letter": its title is the
 * letter, its dek the signature ("Anonymous, second year"), and it links to the Sumat
 * message it came from, which holds the prompt and whether it was signed.
 */
export async function listLetters(
  db: Db,
  { filter, page, perPage }: { filter: LetterFilter; page: number; perPage: number },
) {
  const sentAs: SQL | undefined =
    filter === 'anonymous'
      ? eq(sumatMessages.sentAs, 'anonymous')
      : filter === 'signed'
        ? eq(sumatMessages.sentAs, 'named')
        : undefined;
  const where = and(eq(stories.kind, 'letter'), liveStory, sentAs);
  const [{ total }] = await db
    .select({ total: count() })
    .from(stories)
    .leftJoin(sumatMessages, eq(sumatMessages.id, stories.sourceMessageId))
    .where(where);
  const rows = await db
    .select({
      id: stories.id,
      text: stories.title,
      signature: stories.dek,
      slug: stories.slug,
      sectionSlug: sections.slug,
      publishedAt: stories.publishedAt,
      prompt: sumatMessages.promptText,
    })
    .from(stories)
    .innerJoin(sections, eq(sections.id, stories.sectionId))
    .leftJoin(sumatMessages, eq(sumatMessages.id, stories.sourceMessageId))
    .where(where)
    .orderBy(desc(stories.publishedAt))
    .limit(perPage)
    .offset((page - 1) * perPage);
  return { letters: rows, total, pages: Math.max(1, Math.ceil(total / perPage)) };
}
