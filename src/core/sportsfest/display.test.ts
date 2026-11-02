import { describe, expect, it } from 'vitest';
import {
  festivalDay,
  filterRows,
  manilaDay,
  ordinal,
  roundName,
  rowState,
  scheduleDays,
  tribuInitial,
  tribuTile,
} from './display';

describe('tribuTile', () => {
  it('puts white text on dark colours and black text with a stroke on light ones', () => {
    expect(tribuTile('#DB2926')).toEqual({ fill: '#DB2926', text: '#FFFFFF', outlined: false });
    expect(tribuTile('#178f4d').text).toBe('#FFFFFF');
    expect(tribuTile('#1F57D6').text).toBe('#FFFFFF');
    expect(tribuTile('#FFD400')).toEqual({ fill: '#FFD400', text: '#0A0A0A', outlined: true });
    expect(tribuTile('#FFFFFF').outlined).toBe(true);
  });

  it('falls back to grey for anything that is not a six-digit hex colour', () => {
    for (const bad of ['red', '#FFF', 'url(x)', '#12345g', '']) {
      expect(tribuTile(bad).fill).toBe('#6B6B68');
    }
  });
});

describe('tribuInitial', () => {
  it('takes the first letter, or the number of a numbered tribu', () => {
    expect(tribuInitial('Dayea')).toBe('D');
    expect(tribuInitial(' idiyanale')).toBe('I');
    expect(tribuInitial('Tribu 4')).toBe('4');
    expect(tribuInitial('Tribung Lakapati')).toBe('T');
  });
});

describe('rowState', () => {
  it('is final once a gold is in, even if the event is still running', () => {
    expect(rowState('ongoing', true)).toBe('final');
    expect(rowState('scheduled', true)).toBe('final');
  });

  it('follows the event otherwise', () => {
    expect(rowState('scheduled', false)).toBe('upcoming');
    expect(rowState('ongoing', false)).toBe('ongoing');
    expect(rowState('done', false)).toBe('final');
    expect(rowState('postponed', false)).toBe('postponed');
    expect(rowState('cancelled', false)).toBe('cancelled');
  });
});

describe('manilaDay', () => {
  it('uses the date in Tacloban, not UTC', () => {
    expect(manilaDay(new Date('2026-03-11T17:30:00Z'))).toBe('2026-03-12');
    expect(manilaDay(new Date('2026-03-11T15:59:00Z'))).toBe('2026-03-11');
  });
});

describe('festivalDay', () => {
  it('counts days from the first day', () => {
    expect(festivalDay('2026-03-10', '2026-03-14', '2026-03-10')).toEqual({ day: 1, of: 5 });
    expect(festivalDay('2026-03-10', '2026-03-14', '2026-03-12')).toEqual({ day: 3, of: 5 });
    expect(festivalDay('2026-03-10', '2026-03-14', '2026-03-14')).toEqual({ day: 5, of: 5 });
  });

  it('is null outside the dates, without dates, or when the dates are reversed', () => {
    expect(festivalDay('2026-03-10', '2026-03-14', '2026-03-09')).toBeNull();
    expect(festivalDay('2026-03-10', '2026-03-14', '2026-03-15')).toBeNull();
    expect(festivalDay(null, '2026-03-14', '2026-03-12')).toBeNull();
    expect(festivalDay('2026-03-14', '2026-03-10', '2026-03-12')).toBeNull();
  });

  it('crosses month ends', () => {
    expect(festivalDay('2026-02-27', '2026-03-02', '2026-03-01')).toEqual({ day: 3, of: 4 });
  });
});

describe('scheduleDays', () => {
  const at = (iso: string) => new Date(iso);

  it('groups events by Tacloban day and adds up medal events', () => {
    const days = scheduleDays('2026-03-10', '2026-03-12', [
      { name: 'Chess', startsAt: at('2026-03-10T01:00:00Z'), categories: 2 },
      { name: 'Basketball', startsAt: at('2026-03-10T05:00:00Z'), categories: 1 },
      { name: 'Basketball', startsAt: at('2026-03-11T05:00:00Z'), categories: 1 },
      // 1:00 AM on March 12 in Tacloban is still March 11 in UTC.
      { name: 'Swimming', startsAt: at('2026-03-11T17:00:00Z'), categories: 4 },
    ]);
    expect(days).toEqual([
      { day: 1, date: '2026-03-10', events: ['Chess', 'Basketball'], medalEvents: 3 },
      { day: 2, date: '2026-03-11', events: ['Basketball'], medalEvents: 1 },
      { day: 3, date: '2026-03-12', events: ['Swimming'], medalEvents: 4 },
    ]);
  });

  it('keeps empty days, drops events outside the dates or without a time', () => {
    const days = scheduleDays('2026-03-10', '2026-03-11', [
      { name: 'Chess', startsAt: null, categories: 1 },
      { name: 'Late', startsAt: at('2026-03-20T01:00:00Z'), categories: 1 },
    ]);
    expect(days.map((d) => d.events)).toEqual([[], []]);
  });

  it('lists one event name once per day even with several categories on that day', () => {
    const days = scheduleDays('2026-03-10', '2026-03-10', [
      { name: 'Volleyball', startsAt: at('2026-03-10T01:00:00Z'), categories: 1 },
      { name: 'Volleyball', startsAt: at('2026-03-10T03:00:00Z'), categories: 1 },
    ]);
    expect(days[0]).toMatchObject({ events: ['Volleyball'], medalEvents: 2 });
  });

  it('returns nothing without dates or for impossible ranges', () => {
    expect(scheduleDays(null, null, [])).toEqual([]);
    expect(scheduleDays('2026-03-14', '2026-03-10', [])).toEqual([]);
    expect(scheduleDays('2026-01-01', '2026-12-31', [])).toEqual([]);
  });
});

describe('roundName', () => {
  it('names rounds counting back from the final', () => {
    expect(roundName(2, 2).title).toBe('Final');
    expect(roundName(1, 2).title).toBe('Semifinals');
    expect(roundName(1, 3).match).toBe('Quarterfinal');
    expect(roundName(1, 4).title).toBe('Round 1');
    expect(roundName(1, 1).title).toBe('Final');
  });
});

describe('filterRows', () => {
  const rows = [
    { event: 'Basketball', category: "Men's", state: 'ongoing', day: '2026-03-12', medalists: [] },
    {
      event: 'Basketball',
      category: "Women's",
      state: 'final',
      day: '2026-03-12',
      medalists: [2, 1, 3],
    },
    {
      event: '100 meters',
      category: "Women's",
      state: 'final',
      day: '2026-03-11',
      medalists: [1, 3, 2],
    },
    { event: 'Pétanque', category: 'Mixed', state: 'upcoming', day: null, medalists: [] },
  ] as const;
  const none = { q: '', state: null, tribuId: null, day: null };

  it('keeps everything without filters', () => {
    expect(filterRows(rows, none)).toHaveLength(4);
  });

  it('matches every word against the event and category, ignoring case and accents', () => {
    expect(filterRows(rows, { ...none, q: 'basketball women' })).toEqual([rows[1]]);
    expect(filterRows(rows, { ...none, q: '  100 ' })).toEqual([rows[2]]);
    expect(filterRows(rows, { ...none, q: 'petanque' })).toEqual([rows[3]]);
    expect(filterRows(rows, { ...none, q: 'chess' })).toEqual([]);
  });

  it('combines state, day and tribu filters', () => {
    expect(filterRows(rows, { ...none, state: 'final' })).toHaveLength(2);
    expect(filterRows(rows, { ...none, day: '2026-03-12' })).toHaveLength(2);
    expect(filterRows(rows, { ...none, tribuId: 3, day: '2026-03-11' })).toEqual([rows[2]]);
    expect(filterRows(rows, { ...none, tribuId: 4 })).toEqual([]);
  });
});

describe('ordinal', () => {
  it('handles the teens', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '101st',
      '111th',
    ]);
  });
});
