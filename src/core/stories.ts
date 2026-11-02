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
    case 'save':
      return { status: current.status, publishedAt: chosenDate ?? current.publishedAt };
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
