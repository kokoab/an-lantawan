import { describe, expect, it } from 'vitest';
import { searchTerms, shorterSearch, toFtsQuery } from './query';

describe('toFtsQuery', () => {
  it('quotes each word and matches prefixes', () => {
    expect(toFtsQuery('Library hours')).toBe('"library"* "hours"*');
  });

  it('turns FTS syntax into plain words', () => {
    expect(toFtsQuery('library" OR title:* NEAR(x')).toBe('"library"* "or"* "title"* "near"* "x"*');
  });

  it('returns null for nothing searchable', () => {
    expect(toFtsQuery('  ?!  ')).toBeNull();
    expect(toFtsQuery('')).toBeNull();
  });

  it('keeps Filipino and accented letters', () => {
    expect(searchTerms('Niño Pagkakaisa')).toEqual(['niño', 'pagkakaisa']);
  });

  it('caps the number of words', () => {
    expect(searchTerms('a b c d e f g h i j k')).toHaveLength(8);
  });
});

describe('shorterSearch', () => {
  it('suggests the longest word of a multi-word search', () => {
    expect(shorterSearch('intramurals 2019')).toBe('intramurals');
    expect(shorterSearch('library')).toBeNull();
  });
});
