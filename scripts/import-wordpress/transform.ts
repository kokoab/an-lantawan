/** Step 2: turns downloaded WordPress posts into stories ready to load. No network, no database. */
import type { Doc, Image } from '../../src/core/content/doc.ts';
import { classify, cleanTitle, type Kind, type SectionSlug, slugify } from './classify.ts';
import { type Credit, extractCredits } from './credits.ts';
import { type FoundImage, htmlToDoc } from './html-to-doc.ts';
import { groupPeople, type PeopleResult } from './people.ts';

export interface WpPost {
  ID: number;
  date: string;
  title: string;
  slug: string;
  URL: string;
  content: string;
  categories: Record<string, unknown>;
  tags: Record<string, unknown>;
  featured_image: string;
}

export interface PlannedStory {
  wpId: number;
  title: string;
  slug: string;
  section: SectionSlug;
  kind: Kind;
  tags: string[];
  publishedAt: Date;
  doc: Doc;
  /** Photos in the body, plus the cover if WordPress had a featured image. */
  images: FoundImage[];
  cover: FoundImage | null;
  credits: Credit[];
  needsReview: boolean;
  url: string;
}

const blankImage = (): Image => ({
  type: 'image',
  attrs: { mediaId: null, key: null, alt: '', caption: '' },
});

/**
 * The cover is WordPress's featured image, or else the first photo of the story. A photo
 * that opens the story and is also its cover is taken out of the body so it isn't shown twice.
 */
function pickCover(post: WpPost, doc: Doc, images: FoundImage[]) {
  const sameFile = (a: string, b: string) => a.split('?')[0] === b.split('?')[0];
  const opener = doc.content.findIndex(
    (b) => b.type !== 'paragraph' || (b.content?.length ?? 0) > 0,
  );
  const first = doc.content[opener];
  const openingImage = first?.type === 'image' ? images.find((i) => i.node === first) : undefined;

  if (post.featured_image) {
    const cover = { src: post.featured_image, node: blankImage() };
    if (openingImage && sameFile(openingImage.src, post.featured_image)) {
      cover.node.attrs = { ...openingImage.node.attrs };
      doc.content.splice(opener, 1);
      images.splice(images.indexOf(openingImage), 1);
    }
    return cover;
  }
  if (openingImage) {
    doc.content.splice(opener, 1);
    images.splice(images.indexOf(openingImage), 1);
    return openingImage;
  }
  return images[0]
    ? { src: images[0].src, node: { ...blankImage(), attrs: { ...images[0].node.attrs } } }
    : null;
}

export function planStory(post: WpPost, usedSlugs: Set<string>): PlannedStory {
  const { title, explainer } = cleanTitle(post.title);
  const categories = Object.keys(post.categories);
  const { section, kind, tags, needsReview } = classify(categories, explainer);
  const converted = htmlToDoc(post.content);
  const { doc, credits } = extractCredits(converted.doc);
  const images = converted.images.filter(
    (i) => doc.content.includes(i.node) || containsNode(doc, i.node),
  );
  const cover = pickCover(post, doc, images);

  let slug = slugify(decodeURIComponent(post.slug)) || slugify(title) || `story-${post.ID}`;
  if (usedSlugs.has(slug)) slug = `${slug}-${post.ID}`;
  usedSlugs.add(slug);

  const wpTags = Object.keys(post.tags ?? {});
  return {
    wpId: post.ID,
    title,
    slug,
    section,
    kind,
    tags: [...new Set([...tags, ...wpTags])],
    publishedAt: new Date(post.date),
    doc,
    images,
    cover,
    credits,
    needsReview,
    url: post.URL,
  };
}

function containsNode(doc: Doc, node: Image): boolean {
  const stack: unknown[] = [...doc.content];
  while (stack.length) {
    const n = stack.pop() as { content?: unknown[] };
    if (n === node) return true;
    if (Array.isArray(n?.content)) stack.push(...n.content);
  }
  return false;
}

export interface Plan {
  stories: PlannedStory[];
  people: PeopleResult;
}

export function planImport(posts: WpPost[], aliases: Record<string, string>): Plan {
  const used = new Set<string>();
  // Oldest first, so if two posts share a slug the original keeps it.
  const stories = [...posts]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => planStory(p, used));
  const counts = new Map<string, number>();
  for (const s of stories)
    for (const c of s.credits) counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
  return { stories, people: groupPeople(counts, aliases) };
}
