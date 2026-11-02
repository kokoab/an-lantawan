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
