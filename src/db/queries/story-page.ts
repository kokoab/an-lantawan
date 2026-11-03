import { and, eq } from 'drizzle-orm';
import type { Doc } from '../../core/content/doc';
import type { Db } from '../client';
import { media, people, sections, stories, storyAuthors, storyTags, tags } from '../schema';
import { liveStory } from './live';

export type Credit = {
  name: string;
  slug: string;
  role: 'writer' | 'photographer' | 'artist' | 'editor';
  photoKey: string | null;
  hasProfile: boolean;
};

/** A published story with everything its page shows, or null. */
export async function getStoryPage(db: Db, slug: string) {
  const [row] = await db
    .select({
      story: stories,
      section: { id: sections.id, name: sections.name, slug: sections.slug },
      cover: {
        key: media.key,
        alt: media.alt,
        caption: media.caption,
        creditText: media.creditText,
        width: media.width,
        height: media.height,
        focalX: media.focalX,
        focalY: media.focalY,
      },
    })
    .from(stories)
    .innerJoin(sections, eq(sections.id, stories.sectionId))
    .leftJoin(media, eq(media.id, stories.coverId))
    .where(and(eq(stories.slug, slug), liveStory))
    .limit(1);
  if (!row) return null;

  const [credits, storyTagRows] = await Promise.all([
    db
      .select({
        name: people.name,
        slug: people.slug,
        hasProfile: people.hasProfile,
        role: storyAuthors.role,
        photoKey: media.key,
      })
      .from(storyAuthors)
      .innerJoin(people, eq(people.id, storyAuthors.personId))
      .leftJoin(media, eq(media.id, people.photoId))
      .where(eq(storyAuthors.storyId, row.story.id))
      .orderBy(storyAuthors.sort),
    db
      .select({ name: tags.name, slug: tags.slug })
      .from(storyTags)
      .innerJoin(tags, eq(tags.id, storyTags.tagId))
      .where(eq(storyTags.storyId, row.story.id)),
  ]);

  return {
    ...row.story,
    body: row.story.body as Doc,
    section: row.section,
    cover: row.cover?.key ? { ...row.cover, key: row.cover.key } : null,
    credits: credits as Credit[],
    tags: storyTagRows,
  };
}

export type StoryPage = NonNullable<Awaited<ReturnType<typeof getStoryPage>>>;
