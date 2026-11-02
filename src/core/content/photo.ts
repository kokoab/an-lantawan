/**
 * How the lead story sizes its photo so the frame matches the picture and no grey bars
 * show. Wide photos run full width at their own shape, kept between 4:3 and 2:1. Square
 * and tall pictures (usually graphics with text) sit beside the text instead.
 */
const WIDE = [
  { ratio: 4 / 3, name: '4x3' },
  { ratio: 3 / 2, name: '3x2' },
  { ratio: 16 / 9, name: '16x9' },
  { ratio: 2, name: '2x1' },
] as const;
const TALL = [
  { ratio: 2 / 3, name: '2x3' },
  { ratio: 3 / 4, name: '3x4' },
  { ratio: 4 / 5, name: '4x5' },
  { ratio: 1, name: '1x1' },
] as const;

/** Below this width-to-height ratio a picture counts as square or tall. */
export const TALL_BELOW = 1.3;

const nearest = <T extends { ratio: number }>(list: readonly T[], r: number) =>
  list.reduce((best, s) => (Math.abs(s.ratio - r) < Math.abs(best.ratio - r) ? s : best));

export type LeadShape =
  | { layout: 'wide'; ratio: (typeof WIDE)[number]['name'] }
  | { layout: 'side'; ratio: (typeof TALL)[number]['name'] };

export function leadShape(width: number | null, height: number | null): LeadShape {
  if (!width || !height) return { layout: 'wide', ratio: '16x9' };
  const r = width / height;
  if (r < TALL_BELOW) return { layout: 'side', ratio: nearest(TALL, r).name };
  return { layout: 'wide', ratio: nearest(WIDE, r).name };
}
