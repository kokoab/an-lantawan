import { eq } from 'drizzle-orm';
import { cleanDoc, docMediaIds, parseEmbedUrl } from '../core/content/validate';
import { SLUG, slugify } from '../core/slug';
import { isLive, nextState, readTags } from '../core/stories';
import { canPublish, publishChecks } from '../core/stories-checks';
import type { Db } from '../db/client';
import { findOrCreatePeople } from '../db/queries/admin/staff';
import {
  existingMediaIds,
  type getStoryForEdit,
  saveStory,
  setStoryState,
  storySlugTaken,
} from '../db/queries/admin/stories';
import type { SignedInEditor } from '../db/queries/auth';
import { getSettings, saveSettings } from '../db/queries/settings';
import { media, people, sections, stories } from '../db/schema';
import { record } from './admin';
import type { StoryPayload } from './admin-schemas';

export type Saved =
  | { ok: true; id: number; slug: string; updatedAt: number; status: string }
  | {
      ok: false;
      errors: Record<string, string>;
      conflict?: { by: string | null; updatedAt: number };
    };

type Existing = NonNullable<Awaited<ReturnType<typeof getStoryForEdit>>>;

const randomSlug = () => `draft-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;

/** A free address made from the headline: lakapati-basketball-gold, then -2, -3… if taken. */
async function freeSlug(db: Db, base: string, exceptId: number | null) {
  const root = base || randomSlug();
  for (let n = 1; n < 50; n++) {
    const slug = n === 1 ? root : `${root.slice(0, 76)}-${n}`;
    if (!(await storySlugTaken(db, slug, exceptId))) return slug;
  }
  return randomSlug();
}

/**
 * Saves the editor's payload. Drafts save as they are; a live story keeps its status and
 * date (publishing and scheduling go through `publishStory`). If someone else saved since
 * this editor loaded the story, nothing is saved and the caller is told who.
 */
export async function saveStoryPayload(
  db: Db,
  p: StoryPayload,
  editor: SignedInEditor,
  existing: Existing | null,
): Promise<Saved> {
  if (existing && p.baseUpdatedAt !== null && !p.force) {
    const theirs = existing.updatedAt.getTime();
    if (theirs > p.baseUpdatedAt + 999 && existing.updatedByPersonId !== editor.person?.id) {
      const [by] = existing.updatedByPersonId
        ? await db
            .select({ name: people.name })
            .from(people)
            .where(eq(people.id, existing.updatedByPersonId))
        : [];
      return { ok: false, errors: {}, conflict: { by: by?.name ?? null, updatedAt: theirs } };
    }
  }
  const errors: Record<string, string> = {};
  const body = cleanDoc(p.body);
  if (!body)
    errors.body = 'The story text couldn’t be read. Copy it somewhere safe and reload the page.';
  const tags = readTags(p.tags.join(','));
  if (!tags.ok) errors.tags = tags.error;
  const video = p.videoUrl ? parseEmbedUrl(p.videoUrl) : null;
  if (p.videoUrl && !video) errors.videoUrl = 'Use a YouTube or Google Drive link.';
  const [section] = await db
    .select({ slug: sections.slug })
    .from(sections)
    .where(eq(sections.id, p.sectionId));
  if (!section) errors.sectionId = 'Choose a section from the list.';

  const live = existing ? isLive(existing, new Date()) : false;
  let slug: string;
  if (p.slugAuto && !live) slug = await freeSlug(db, slugify(p.title), existing?.id ?? null);
  else {
    slug = p.slug || existing?.slug || randomSlug();
    if (!SLUG.test(slug)) errors.slug = 'Use lowercase letters, numbers and dashes only.';
    else if (await storySlugTaken(db, slug, existing?.id ?? null))
      errors.slug = 'Another story uses this link.';
  }
  if (Object.keys(errors).length || !body || !tags.ok || !section) return { ok: false, errors };

  const credited = await findOrCreatePeople(db, [
    ...p.credits.writer,
    ...p.credits.photographer,
    ...p.credits.artist,
  ]);
  const credits = (['writer', 'photographer', 'artist'] as const).flatMap((role) =>
    p.credits[role].flatMap((name) => {
      const personId = credited.get(name.trim().toLowerCase());
      return personId ? [{ personId, role }] : [];
    }),
  );
  const mediaIds = await existingMediaIds(db, docMediaIds(body));
  const id = await saveStory(
    db,
    existing
      ? { id: existing.id, slug: existing.slug, sectionSlug: existing.sectionSlug, wasLive: live }
      : null,
    {
      sectionId: p.sectionId,
      kind: p.kind,
      status: existing?.status ?? 'draft',
      title: p.title,
      slug,
      dek: p.dek || null,
      body,
      coverId: p.coverId,
      cartoonOnTop: p.cartoonOnTop,
      writerPhoto: p.writerPhoto,
      videoUrl: video?.url ?? null,
      publishedAt: existing?.publishedAt ?? null,
      credits,
      tags: tags.tags,
      eventIds: p.eventIds,
      mediaIds,
      shareTitle: p.shareTitle || null,
      shareSummary: p.shareSummary || null,
      personId: editor.person?.id ?? null,
    },
    editor.id,
    section.slug,
  );

  await setPinned(db, id, p.pinned, editor, p.title);
  if (!existing) {
    await record(editor, {
      action: 'create',
      entityType: 'story',
      entityId: id,
      summary: `Started “${p.title || 'Untitled draft'}”`,
    });
  }
  const [saved] = await db
    .select({ updatedAt: stories.updatedAt, status: stories.status })
    .from(stories)
    .where(eq(stories.id, id));
  return { ok: true, id, slug, updatedAt: saved.updatedAt.getTime(), status: saved.status };
}

/** Pins or unpins a story as the homepage top story, logging it with an undo. */
export async function setPinned(
  db: Db,
  id: number,
  pinned: boolean,
  editor: SignedInEditor,
  title: string,
) {
  const { 'home.pinned_story_id': current } = await getSettings(db, {
    'home.pinned_story_id': null as number | null,
  });
  const next = pinned ? id : current === id ? null : current;
  if (next === current) return;
  await saveSettings(db, { 'home.pinned_story_id': next }, editor.id);
  await record(editor, {
    action: 'update',
    entityType: 'home',
    entityId: id,
    summary: pinned ? `Pinned “${title}” as the top story` : `Unpinned “${title}”`,
    undo: { kind: 'settings', before: { 'home.pinned_story_id': current } },
  });
}

/** The checks shown in “Before you publish”, for a saved story. */
export async function checksFor(db: Db, story: Existing) {
  const [cover] = story.coverId
    ? await db.select({ alt: media.alt }).from(media).where(eq(media.id, story.coverId))
    : [];
  return publishChecks({
    title: story.title,
    dek: story.dek,
    sectionId: story.sectionId,
    slug: story.slug,
    body: story.body,
    writers: story.credits.filter((c) => c.role === 'writer' || c.role === 'artist').length,
    cover: cover ? { alt: cover.alt } : null,
    needsText: !['cartoon', 'photo', 'video'].includes(story.kind),
  });
}

/** Publishes now, or schedules for `at`. Refused while “Before you publish” lists a problem. */
export async function publishStory(
  db: Db,
  story: Existing,
  editor: SignedInEditor,
  at: Date | null,
) {
  const checks = await checksFor(db, story);
  if (!canPublish(checks)) return { ok: false as const, checks };
  const now = new Date();
  const next = nextState(story, 'publish', at, now);
  await setStoryState(db, story.id, next.status, next.publishedAt);
  await record(editor, {
    action: next.status === 'scheduled' ? 'schedule' : 'publish',
    entityType: 'story',
    entityId: story.id,
    summary: `${next.status === 'scheduled' ? 'Scheduled' : 'Published'} “${story.title}”`,
    undo: {
      kind: 'story-state',
      storyId: story.id,
      status: story.status,
      publishedAt: story.publishedAt?.toISOString() ?? null,
    },
  });
  return { ok: true as const, status: next.status, publishedAt: next.publishedAt };
}

/** Moves a story back to drafts or archives it, with an undo. */
export async function changeStoryState(
  db: Db,
  story: Existing,
  editor: SignedInEditor,
  intent: 'unpublish' | 'archive' | 'restore',
) {
  const next = nextState(story, intent, null, new Date());
  await setStoryState(db, story.id, next.status, next.publishedAt);
  const VERB = { unpublish: 'Moved to drafts', archive: 'Archived', restore: 'Restored' };
  await record(editor, {
    action: intent,
    entityType: 'story',
    entityId: story.id,
    summary: `${VERB[intent]} “${story.title}”`,
    undo: {
      kind: 'story-state',
      storyId: story.id,
      status: story.status,
      publishedAt: story.publishedAt?.toISOString() ?? null,
    },
  });
}
