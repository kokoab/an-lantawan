import { eq } from 'drizzle-orm';
import { type Doc, emptyDoc } from '../core/content/doc';
import type { Db } from '../db/client';
import { listAllSections } from '../db/queries/admin/sections';
import { listPeopleChoices } from '../db/queries/admin/staff';
import { getStoryForEdit, listEventChoices } from '../db/queries/admin/stories';
import { getSettings } from '../db/queries/settings';
import { media, people } from '../db/schema';

/** A story as the editor holds it. */
export interface EditorStory {
  id: number | null;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  sectionId: number;
  kind: string;
  title: string;
  slug: string;
  dek: string;
  credits: { writer: string[]; photographer: string[]; artist: string[] };
  body: Doc;
  cover: {
    id: number;
    key: string;
    alt: string;
    caption: string;
    credit: string;
    focalX: number;
    focalY: number;
  } | null;
  cartoonOnTop: boolean;
  writerPhoto: boolean;
  videoUrl: string;
  tags: string[];
  eventIds: number[];
  shareTitle: string;
  shareSummary: string;
  pinned: boolean;
  publishedAt: number | null;
  updatedAt: number | null;
  savedBy: string | null;
  sectionSlug: string;
}

export interface EditorChoices {
  sections: Array<{ id: number; name: string; slug: string; parentId: number | null }>;
  people: string[];
  events: Array<{ id: number; name: string; year: number }>;
}

/** Everything the story editor needs to start: the story (or a blank one) and the choices. */
export async function storyEditorProps(
  db: Db,
  id: number | null,
  defaults: { sectionId?: number } = {},
): Promise<(EditorChoices & { story: EditorStory }) | null> {
  const [sections, staff, events, pin] = await Promise.all([
    listAllSections(db),
    listPeopleChoices(db),
    listEventChoices(db),
    getSettings(db, { 'home.pinned_story_id': null as number | null }),
  ]);
  const live = sections.filter((s) => !s.archivedAt);
  const choices: EditorChoices = {
    sections: live.map((s) => ({ id: s.id, name: s.name, slug: s.slug, parentId: s.parentId })),
    people: staff.map((p) => p.name),
    events,
  };
  if (id === null) {
    const sectionId = live.find((s) => s.id === defaults.sectionId)?.id ?? live[0]?.id ?? 1;
    return {
      ...choices,
      story: {
        id: null,
        status: 'draft',
        sectionId,
        kind: 'article',
        title: '',
        slug: '',
        dek: '',
        credits: { writer: [], photographer: [], artist: [] },
        body: emptyDoc(),
        cover: null,
        cartoonOnTop: false,
        writerPhoto: false,
        videoUrl: '',
        tags: [],
        eventIds: [],
        shareTitle: '',
        shareSummary: '',
        pinned: false,
        publishedAt: null,
        updatedAt: null,
        savedBy: null,
        sectionSlug: live.find((s) => s.id === sectionId)?.slug ?? '',
      },
    };
  }
  const story = await getStoryForEdit(db, id);
  if (!story) return null;
  const [cover] = story.coverId
    ? await db
        .select({
          id: media.id,
          key: media.key,
          alt: media.alt,
          caption: media.caption,
          creditText: media.creditText,
          creditName: people.name,
          focalX: media.focalX,
          focalY: media.focalY,
        })
        .from(media)
        .leftJoin(people, eq(people.id, media.creditPersonId))
        .where(eq(media.id, story.coverId))
    : [];
  const [savedBy] = story.updatedByPersonId
    ? await db
        .select({ name: people.name })
        .from(people)
        .where(eq(people.id, story.updatedByPersonId))
    : [];
  const names = (role: string) => story.credits.filter((c) => c.role === role).map((c) => c.name);
  return {
    ...choices,
    story: {
      id: story.id,
      status: story.status,
      sectionId: story.sectionId,
      kind: story.kind,
      title: story.title,
      slug: story.slug,
      dek: story.dek ?? '',
      credits: {
        writer: names('writer'),
        photographer: names('photographer'),
        artist: names('artist'),
      },
      body: story.body,
      cover: cover
        ? {
            id: cover.id,
            key: cover.key,
            alt: cover.alt ?? '',
            caption: cover.caption ?? '',
            credit: cover.creditName ?? cover.creditText ?? '',
            focalX: cover.focalX,
            focalY: cover.focalY,
          }
        : null,
      cartoonOnTop: story.cartoonOnTop,
      writerPhoto: story.writerPhoto,
      videoUrl: story.videoUrl ?? '',
      tags: story.tags,
      eventIds: story.eventIds,
      shareTitle: story.shareTitle ?? '',
      shareSummary: story.shareSummary ?? '',
      pinned: pin['home.pinned_story_id'] === story.id,
      publishedAt: story.publishedAt?.getTime() ?? null,
      updatedAt: story.updatedAt.getTime(),
      savedBy: savedBy?.name ?? null,
      sectionSlug: story.sectionSlug,
    },
  };
}
