import { describe, expect, it } from 'vitest';
import { parsePage } from './paging';

describe('parsePage', () => {
  it.each([
    [null, 1],
    ['', 1],
    ['1', 1],
    ['12', 12],
    ['0', null],
    ['-1', null],
    ['2.5', null],
    ['abc', null],
    ['1e3', null],
    ['999999', null],
  ])('%s → %s', (input, expected) => {
    expect(parsePage(input)).toBe(expected);
  });
});
