import { describe, expect, it } from 'vitest';
import { isLive, nextState } from './stories';

const now = new Date('2026-11-03T04:00:00Z');
const past = new Date('2026-10-01T00:00:00Z');
const future = new Date('2026-11-10T00:00:00Z');
const draft = { status: 'draft' as const, publishedAt: null };
const live = { status: 'published' as const, publishedAt: past };

const state = (r: ReturnType<typeof nextState>) => r;

describe('nextState', () => {
  it('publishes a new story now', () => {
    expect(state(nextState(draft, 'publish', null, now))).toEqual({
      status: 'published',
      publishedAt: now,
    });
  });

  it('schedules when the chosen date is in the future', () => {
    expect(state(nextState(draft, 'publish', future, now))).toEqual({
      status: 'scheduled',
      publishedAt: future,
    });
  });

  it('backdates when the chosen date is in the past', () => {
    expect(state(nextState(draft, 'publish', past, now))).toEqual({
      status: 'published',
      publishedAt: past,
    });
  });

  it('keeps the first publication date when republished', () => {
    const unpublished = state(nextState(live, 'unpublish', null, now));
    expect(unpublished).toEqual({ status: 'draft', publishedAt: past });
    expect(state(nextState(unpublished, 'publish', null, now))).toEqual(live);
  });

  it('saving keeps the status, and a scheduled story can move to another future time', () => {
    expect(state(nextState(live, 'save', null, now))).toEqual(live);
    const scheduled = { status: 'scheduled' as const, publishedAt: future };
    const later = new Date('2026-12-01T00:00:00Z');
    expect(state(nextState(scheduled, 'save', later, now))).toEqual({
      status: 'scheduled',
      publishedAt: later,
    });
  });

  it('archives and restores to a draft', () => {
    const archived = state(nextState(live, 'archive', null, now));
    expect(archived).toEqual({ status: 'archived', publishedAt: past });
    expect(state(nextState(archived, 'restore', null, now))).toEqual({
      status: 'draft',
      publishedAt: past,
    });
  });
});

describe('isLive', () => {
  it('shows published stories and scheduled ones whose time has come', () => {
    expect(isLive(live, now)).toBe(true);
    expect(isLive({ status: 'scheduled', publishedAt: past }, now)).toBe(true);
    expect(isLive({ status: 'scheduled', publishedAt: future }, now)).toBe(false);
    expect(isLive(draft, now)).toBe(false);
    expect(isLive({ status: 'archived', publishedAt: past }, now)).toBe(false);
  });
});
