/** Where an uploaded file is served from. Keys are unique per upload, so URLs never go stale. */
export const mediaUrl = (key: string) => `/media/${key}`;

export const storyUrl = (s: { slug: string; section: { slug: string } }) =>
  `/${s.section.slug}/${s.slug}`;

const step = (v: number) => Math.min(10, Math.max(0, Math.round(v * 10))) * 10;

/**
 * Classes that crop a photo around its focal point (0–1 on each axis), in steps of 10%.
 * Classes instead of a style attribute, because the Content-Security-Policy blocks those.
 */
export const focalClasses = (p: { focalX: number; focalY: number }) =>
  `fx-${step(p.focalX)} fy-${step(p.focalY)}`;

/**
 * Square and tall pictures (usually graphics with text on them) are shown whole rather
 * than cropped to the slot, so none of their text is cut off.
 */
export const showWhole = (p: { width: number | null; height: number | null }) =>
  p.width !== null && p.height !== null && p.width / p.height < 1.3;

/** The small label above a headline: the story's kind where it matters, else its section. */
export function storyLabel(s: { kind: string; section: { name: string } }): string {
  if (s.kind === 'explainer') return 'Explainer';
  if (s.kind === 'editorial') return 'Editorial';
  if (s.kind === 'cartoon') return 'Editorial cartoon';
  return s.section.name;
}
