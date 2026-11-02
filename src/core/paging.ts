export const STORIES_PER_PAGE = 9;

/** The page number from `?page=`, or null if it isn't a whole number from 1 to 10,000. */
export function parsePage(value: string | null): number | null {
  if (value === null || value === '') return 1;
  if (!/^\d{1,5}$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 && n <= 10_000 ? n : null;
}
