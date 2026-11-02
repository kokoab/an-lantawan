import { eq } from 'drizzle-orm';
import { cleanDoc, docMediaIds, isEmptyDoc, parseEmbedUrl } from '../core/content/validate';
import { type FormValues, parseForm } from '../core/forms';
import { isLive, nextState, readCredits, readTags, type SaveIntent } from '../core/stories';
import type { Db } from '../db/client';
import { existingMediaIds, saveStory, storySlugTaken } from '../db/queries/admin/stories';
import type { SignedInEditor } from '../db/queries/auth';
import { getSettings, saveSettings } from '../db/queries/settings';
import { sections } from '../db/schema';
import { type DoneCode, one, record } from './admin';
import { storyForm } from './admin-schemas';

export interface ExistingStory {
  id: number;
  slug: string;
  sectionSlug: string;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  publishedAt: Date | null;
}

const INTENTS: SaveIntent[] = ['save', 'draft', 'publish', 'unpublish'];
const VERB: Partial<Record<DoneCode, string>> = {
  published: 'Published',
  scheduled: 'Scheduled',
  unpublished: 'Moved to drafts',
  created: 'Started',
  saved: 'Edited',
};

/** Checks and saves the story form. Returns the story ID and the notice to show. */
export async function saveStoryForm(
  db: Db,
  values: FormValues,
  editor: SignedInEditor,
  existing: ExistingStory | null,
): Promise<
  { ok: true; id: number; done: DoneCode } | { ok: false; errors: Record<string, string> }
> {
  const now = new Date();
  const asked = one(values, 'intent');
  const publishNow = asked === 'publish-now';
  const intent: SaveIntent = publishNow
    ? 'publish'
    : INTENTS.includes(asked as SaveIntent)
      ? (asked as SaveIntent)
      : 'save';

  const parsed = parseForm(storyForm, values);
  if (!parsed.ok) return parsed;
  const f = parsed.data;
  const errors: Record<string, string> = {};

  let raw: unknown = null;
  try {
    raw = JSON.parse(f.body || '{"type":"doc","content":[]}');
  } catch {
    // Reported below.
  }
  const body = cleanDoc(raw);
  if (!body)
    errors.body = 'The story text couldn’t be read. Copy it somewhere safe and reload the page.';

  const credits = readCredits(f.creditPerson, f.creditRole);
  if (!credits.ok) errors.credits = credits.error;
  const tags = readTags(f.tags);
  if (!tags.ok) errors.tags = tags.error;
  const video = f.videoUrl ? parseEmbedUrl(f.videoUrl) : null;
  if (f.videoUrl && !video) errors.videoUrl = 'Use a YouTube or Google Drive link.';
  if (await storySlugTaken(db, f.slug, existing?.id ?? null))
    errors.slug = 'Another story uses this URL name.';
  const [section] = await db
    .select({ slug: sections.slug })
    .from(sections)
    .where(eq(sections.id, f.sectionId));
  if (!section) errors.sectionId = 'Choose a section from the list.';
  const going =
    intent === 'publish' ||
    (intent === 'save' &&
      existing &&
      existing.status !== 'draft' &&
      existing.status !== 'archived');
  if (going && body && isEmptyDoc(body) && !f.coverId && !video) {
    errors.body = 'Add the story text, a cover photo or a video before publishing.';
  }
  if (Object.keys(errors).length || !body || !credits.ok || !tags.ok || !section) {
    return { ok: false, errors };
  }

  const current = existing ?? { status: 'draft' as const, publishedAt: null };
  const next = nextState(current, intent, publishNow ? now : f.publishedAt, now);
  const mediaIds = await existingMediaIds(db, docMediaIds(body));
  const eventIds = [...new Set(f.eventIds.map(Number).filter((n) => Number.isInteger(n) && n > 0))];

  const id = await saveStory(
    db,
    existing ? { ...existing, wasLive: isLive(existing, now) } : null,
    {
      sectionId: f.sectionId,
      kind: f.kind,
      status: next.status,
      title: f.title,
      slug: f.slug,
      dek: f.dek,
      body,
      coverId: f.coverId,
      cartoonOnTop: f.cartoonOnTop,
      writerPhoto: f.writerPhoto,
      videoUrl: video?.url ?? null,
      publishedAt: next.publishedAt,
      credits: credits.credits,
      tags: tags.tags,
      eventIds,
      mediaIds,
    },
    editor.id,
    section.slug,
  );

  // Pinning puts this story at the top of the homepage instead of the newest one.
  const { 'home.pinned_story_id': pinned } = await getSettings(db, {
    'home.pinned_story_id': null as number | null,
  });
  if (f.pinned && pinned !== id) await saveSettings(db, { 'home.pinned_story_id': id }, editor.id);
  if (!f.pinned && pinned === id)
    await saveSettings(db, { 'home.pinned_story_id': null }, editor.id);

  const done: DoneCode =
    next.status === 'scheduled' && current.status !== 'scheduled'
      ? 'scheduled'
      : next.status === 'published' && current.status !== 'published'
        ? 'published'
        : next.status === 'draft' && current.status !== 'draft' && existing
          ? 'unpublished'
          : existing
            ? 'saved'
            : 'created';
  await record(editor, {
    action: existing ? 'update' : 'create',
    entityType: 'story',
    entityId: id,
    summary: `${VERB[done] ?? 'Edited'} “${f.title}”`,
  });
  return { ok: true, id, done };
}
