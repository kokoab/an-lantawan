import { describe, expect, it } from 'vitest';
import { formatToday, formatWhen } from './when';

// 2:41 PM on Thursday, March 12, 2026 in Tacloban.
const now = new Date('2026-03-12T06:41:00Z');

describe('formatWhen', () => {
  it('says today, yesterday and tomorrow in Tacloban time', () => {
    expect(formatWhen(new Date('2026-03-12T06:41:00Z'), now)).toBe('Today, 2:41 PM');
    expect(formatWhen(new Date('2026-03-11T10:10:00Z'), now)).toBe('Yesterday, 6:10 PM');
    expect(formatWhen(new Date('2026-03-13T00:00:00Z'), now)).toBe('Tomorrow, 8:00 AM');
  });

  it('crosses midnight by the Philippine clock, not UTC', () => {
    // 11:30 PM UTC on the 11th is 7:30 AM on the 12th in Tacloban.
    expect(formatWhen(new Date('2026-03-11T23:30:00Z'), now)).toBe('Today, 7:30 AM');
  });

  it('gives the date further out, with the year only when it differs', () => {
    expect(formatWhen(new Date('2026-03-09T01:02:00Z'), now)).toBe('March 9, 9:02 AM');
    expect(formatWhen(new Date('2025-09-12T01:00:00Z'), now, { withTime: false })).toBe(
      'September 12, 2025',
    );
    expect(formatWhen(null, now)).toBe('');
  });
});

describe('formatWhen for story lists', () => {
  it('shows older dates with their year and no time, but keeps times close to now', () => {
    const o = { olderAsDate: true };
    expect(formatWhen(new Date('2026-03-11T01:00:00Z'), now, o)).toBe('Yesterday, 9:00 AM');
    expect(formatWhen(new Date('2026-03-10T01:00:00Z'), now, o)).toBe('March 10, 2026');
    expect(formatWhen(new Date('2026-03-14T00:00:00Z'), now, o)).toBe('March 14, 8:00 AM');
  });
});

describe('formatToday', () => {
  it('names the weekday', () => {
    expect(formatToday(now)).toBe('Thursday, March 12');
  });
});
