import { describe, expect, it } from 'vitest';
import { isLive, nextState, readCredits, readTags } from './stories';

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

  it('moves a live story to scheduled when its date is set in the future, and back', () => {
    expect(state(nextState(live, 'save', future, now))).toEqual({
      status: 'scheduled',
      publishedAt: future,
    });
    const scheduled = { status: 'scheduled' as const, publishedAt: future };
    expect(state(nextState(scheduled, 'save', past, now))).toEqual({
      status: 'published',
      publishedAt: past,
    });
    expect(state(nextState(draft, 'save', future, now))).toEqual({
      status: 'draft',
      publishedAt: future,
    });
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

describe('readCredits', () => {
  it('pairs people with roles, skipping empty rows and repeats', () => {
    expect(
      readCredits(['4', '', '7', '4'], ['writer', 'writer', 'photographer', 'writer']),
    ).toEqual({
      ok: true,
      credits: [
        { personId: 4, role: 'writer' },
        { personId: 7, role: 'photographer' },
      ],
    });
  });

  it('lets one person hold two roles', () => {
    const r = readCredits(['4', '4'], ['writer', 'photographer']);
    expect(r.ok && r.credits.length).toBe(2);
  });

  it('refuses unknown people and roles', () => {
    expect(readCredits(['x'], ['writer'])).toEqual({
      ok: false,
      error: 'Credit 1: choose someone from the list.',
    });
    expect(readCredits(['3'], ['boss'])).toEqual({
      ok: false,
      error: 'Credit 1: choose what they did.',
    });
  });
});

describe('readTags', () => {
  it('splits, trims and removes repeats regardless of case', () => {
    expect(readTags(' Sportsfest, basketball ,, sportsfest , SSC  elections')).toEqual({
      ok: true,
      tags: ['Sportsfest', 'basketball', 'SSC elections'],
    });
  });

  it('limits length and count', () => {
    expect(readTags('x'.repeat(41)).ok).toBe(false);
    expect(readTags(Array.from({ length: 11 }, (_, i) => `t${i}`).join(',')).ok).toBe(false);
  });
});
