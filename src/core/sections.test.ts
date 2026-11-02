import { describe, expect, it } from 'vitest';
import { parentProblem } from './sections';

const all = [
  { id: 1, parentId: null }, // News
  { id: 3, parentId: null }, // Features
  { id: 5, parentId: 3 }, // Sci-Tech under Features
];

describe('parentProblem', () => {
  it('allows top level and one level down', () => {
    expect(parentProblem(1, null, all)).toBeNull();
    expect(parentProblem(null, 3, all)).toBeNull();
    expect(parentProblem(5, 1, all)).toBeNull();
  });

  it('refuses loops, unknown parents and a second level', () => {
    expect(parentProblem(3, 3, all)).toMatch(/itself/);
    expect(parentProblem(1, 99, all)).toMatch(/list/);
    expect(parentProblem(null, 5, all)).toMatch(/top-level/);
  });

  it('keeps a section with subsections at the top', () => {
    expect(parentProblem(3, 1, all)).toMatch(/has subsections/);
  });
});
