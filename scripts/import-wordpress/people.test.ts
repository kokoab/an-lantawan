import { describe, expect, it } from 'vitest';
import { groupPeople, nameKey } from './people.ts';

const counts = (...names: string[]) => new Map(names.map((n) => [n, 1]));

describe('nameKey', () => {
  it('ignores accents, middle initials and Jr.', () => {
    expect(nameKey('Christian Dave Noseñas')).toBe(nameKey('Christian Dave Nosenas'));
    expect(nameKey('Chyska L. Rojas')).toBe('chyska rojas');
    expect(nameKey('Eugenio L. Permejo Jr.')).toBe('eugenio permejo');
  });
});

describe('groupPeople', () => {
  it('merges spellings that differ only by initials or accents, keeping the fullest', () => {
    const { canonical } = groupPeople(
      counts('Chyska Rojas', 'Chyska L. Rojas', 'Christian Dave Nosenas', 'Christian Dave Noseñas'),
    );
    expect(canonical.get('Chyska Rojas')).toBe('Chyska L. Rojas');
    expect(canonical.get('Christian Dave Nosenas')).toBe(canonical.get('Christian Dave Noseñas'));
  });

  it('merges a short name into the one longer name it fits', () => {
    const { canonical } = groupPeople(
      counts('Gio Costuna', 'Gio Marion Costuna', 'Gio Marion Artiga Costuna'),
    );
    expect(new Set(canonical.values())).toEqual(new Set(['Gio Marion Artiga Costuna']));
  });

  it('does not guess when a short name fits two different people', () => {
    const { canonical, review } = groupPeople(
      counts('Darlin Margate', 'Darlin Mae Margate', 'Darlin Claire Margate'),
    );
    expect(canonical.get('Darlin Margate')).toBe('Darlin Margate');
    expect(review.some((r) => r.why === 'could be either')).toBe(true);
  });

  it('only suggests near spellings and lets aliases decide', () => {
    const names = counts('Emerson P. Obillo', 'Emmerson P. Obillo');
    expect(groupPeople(names).review.length).toBeGreaterThan(0);
    expect(groupPeople(names).canonical.get('Emmerson P. Obillo')).toBe('Emmerson P. Obillo');
    const decided = groupPeople(names, { 'Emmerson P. Obillo': 'Emerson P. Obillo' });
    expect(decided.canonical.get('Emmerson P. Obillo')).toBe('Emerson P. Obillo');
  });

  it('keeps different people with the same surname apart', () => {
    const { canonical } = groupPeople(counts('Mary Rose Go', 'Christopher Go'));
    expect(canonical.get('Mary Rose Go')).toBe('Mary Rose Go');
    expect(canonical.get('Christopher Go')).toBe('Christopher Go');
  });
});
