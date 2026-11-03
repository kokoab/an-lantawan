import { describe, expect, it } from 'vitest';
import { barShares, chartNumber, linePoints } from './chart';

const rows = (...values: number[]) =>
  values.map((value, i) => ({ label: String(i), value, highlight: false }));

describe('barShares', () => {
  it('sizes bars against the longest', () => {
    expect(barShares(rows(26000, 4383, 5698))).toEqual([100, 16.9, 21.9]);
  });
  it('copes with zeros and negatives', () => {
    expect(barShares(rows(0, 0))).toEqual([0, 0]);
    expect(barShares(rows(-5, 10))).toEqual([0, 100]);
  });
});

describe('linePoints', () => {
  it('spreads points across the width with the highest at the top', () => {
    expect(linePoints(rows(0, 10), 100, 50)).toEqual([
      { x: 8, y: 42 },
      { x: 92, y: 8 },
    ]);
  });
  it('keeps a flat or single-point line inside the box', () => {
    expect(linePoints(rows(5, 5), 100, 50).every((p) => p.y === 42)).toBe(true);
    expect(linePoints(rows(5), 100, 50)).toEqual([{ x: 8, y: 42 }]);
    expect(linePoints([], 100, 50)).toEqual([]);
  });
});

describe('chartNumber', () => {
  it('groups thousands', () => {
    expect(chartNumber(26000)).toBe('26,000');
    expect(chartNumber(12.5)).toBe('12.5');
  });
});
