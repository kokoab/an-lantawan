/** How a story's status and date change when an editor saves it. */

export type StoryStatus = 'draft' | 'scheduled' | 'published' | 'archived';
export type SaveIntent = 'save' | 'draft' | 'publish' | 'unpublish' | 'archive' | 'restore';

export interface StoryState {
  status: StoryStatus;
  publishedAt: Date | null;
}

/**
 * The status and date after a save. Publishing with a date in the future schedules the
 * story; it goes live on its own at that time (see `isLive`). A story keeps its first
 * publication date when it is republished, unless an editor sets another.
 */
export function nextState(
  current: StoryState,
  intent: SaveIntent,
  chosenDate: Date | null,
  now: Date,
): StoryState {
  switch (intent) {
    case 'save': {
      const at = chosenDate ?? current.publishedAt;
      // Moving a live story's date into the future takes it off the site until then.
      if ((current.status === 'published' || current.status === 'scheduled') && at) {
        return { status: at > now ? 'scheduled' : 'published', publishedAt: at };
      }
      return { status: current.status, publishedAt: at };
    }
    case 'draft':
    case 'unpublish':
      return { status: 'draft', publishedAt: chosenDate ?? current.publishedAt };
    case 'publish': {
      const at = chosenDate ?? current.publishedAt ?? now;
      return { status: at > now ? 'scheduled' : 'published', publishedAt: at };
    }
    case 'archive':
      return { status: 'archived', publishedAt: current.publishedAt };
    case 'restore':
      return { status: 'draft', publishedAt: current.publishedAt };
  }
}

/** Whether readers can see a story right now. */
export const isLive = (s: StoryState, now: Date) =>
  s.status === 'published' ||
  (s.status === 'scheduled' && s.publishedAt !== null && s.publishedAt <= now);

export const CREDIT_ROLES = ['writer', 'photographer', 'artist', 'editor'] as const;
export type CreditRole = (typeof CREDIT_ROLES)[number];

/**
 * Bylines from the form's parallel lists of people and roles. Empty rows are skipped and a
 * person is credited once per role, in the order given.
 */
export function readCredits(
  personIds: string[],
  roles: string[],
):
  | { ok: true; credits: Array<{ personId: number; role: CreditRole }> }
  | { ok: false; error: string } {
  const credits: Array<{ personId: number; role: CreditRole }> = [];
  const seen = new Set<string>();
  for (let i = 0; i < personIds.length; i++) {
    const raw = (personIds[i] ?? '').trim();
    if (!raw) continue;
    const personId = Number(raw);
    const role = (roles[i] ?? 'writer') as CreditRole;
    if (!Number.isInteger(personId) || personId <= 0)
      return { ok: false, error: `Credit ${i + 1}: choose someone from the list.` };
    if (!CREDIT_ROLES.includes(role))
      return { ok: false, error: `Credit ${i + 1}: choose what they did.` };
    const key = `${personId}:${role}`;
    if (seen.has(key)) continue;
    seen.add(key);
    credits.push({ personId, role });
  }
  if (credits.length > 20) return { ok: false, error: 'Keep it to 20 credits.' };
  return { ok: true, credits };
}

/** Tags typed as a comma-separated list: trimmed, without repeats, at most ten. */
export function readTags(raw: string): { ok: true; tags: string[] } | { ok: false; error: string } {
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const tag = part.trim().replace(/\s+/g, ' ');
    if (!tag) continue;
    if (tag.length > 40)
      return { ok: false, error: `“${tag.slice(0, 20)}…” is too long for a tag.` };
    if (!out.some((t) => t.toLowerCase() === tag.toLowerCase())) out.push(tag);
  }
  if (out.length > 10) return { ok: false, error: 'Use at most ten tags.' };
  return { ok: true, tags: out };
}
