/** Turning a Sumat message into a published letter. */

import type { Doc } from '../content/doc';

/**
 * The signature under a published letter. Anonymous letters always say "Anonymous", so
 * nothing about the sender can slip into print; signed ones use the name and course given.
 */
export function defaultSignature(
  sentAs: 'anonymous' | 'named',
  name: string | null,
  courseYear: string | null,
) {
  if (sentAs === 'anonymous') return 'Anonymous';
  return [name?.trim(), courseYear?.trim()].filter(Boolean).join(', ') || 'Anonymous';
}

/** Where a letter lives: /<section>/letter-<message id>, unique per message. */
export const letterSlug = (messageId: number) => `letter-${messageId}`;

const words = (s: string) =>
  new Set(
    s
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 1),
  );

/** How alike two letters are, from 0 to 1, by the words they share. */
export function likeness(a: string, b: string) {
  const x = words(a);
  const y = words(b);
  if (!x.size || !y.size) return 0;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared++;
  return shared / (x.size + y.size - shared);
}

/**
 * Letters that look like a copy of an earlier one sent within a day: the same person
 * pressing Send twice, or a friend pasting the same text. Maps each to the earlier letter.
 */
export function possibleDuplicates(
  letters: ReadonlyArray<{ id: number; body: string; receivedAt: Date }>,
  threshold = 0.8,
) {
  const sorted = [...letters].sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime());
  const found = new Map<number, { id: number; receivedAt: Date }>();
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i - 1; j >= 0; j--) {
      if (sorted[i].receivedAt.getTime() - sorted[j].receivedAt.getTime() > 86_400_000) break;
      if (likeness(sorted[i].body, sorted[j].body) >= threshold) {
        found.set(sorted[i].id, { id: sorted[j].id, receivedAt: sorted[j].receivedAt });
        break;
      }
    }
  }
  return found;
}

/** The ways a letter can be signed. An anonymous letter can only go out anonymously. */
export function signatureChoices(
  sentAs: 'anonymous' | 'named',
  name: string | null,
  courseYear: string | null,
) {
  const course = courseYear?.trim();
  const anonymous = course ? [`Anonymous, ${course}`, 'Anonymous'] : ['Anonymous'];
  if (sentAs === 'anonymous') return anonymous;
  const signed = defaultSignature('named', name, courseYear);
  return [...new Set([signed, ...(name?.trim() ? [name.trim()] : []), ...anonymous])];
}

const RELATED = 'Read our story on this';

/** A letter's body when it points to our story on the same subject: one link, nothing else. */
export const relatedStoryBody = (href: string): Doc => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: RELATED, marks: [{ type: 'link', attrs: { href } }] }],
    },
  ],
});

/** The story a letter points to, if any. Only links within the site count. */
export function relatedStoryHref(body: Doc | null | undefined) {
  for (const block of body?.content ?? []) {
    if (block.type !== 'paragraph') continue;
    for (const node of block.content ?? []) {
      if (node.type !== 'text') continue;
      const link = node.marks?.find((m) => m.type === 'link');
      if (
        link?.type === 'link' &&
        link.attrs.href.startsWith('/') &&
        !link.attrs.href.startsWith('//')
      ) {
        return link.attrs.href;
      }
    }
  }
  return null;
}
