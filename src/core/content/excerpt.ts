import type { Block, Doc } from './doc';
import { inlineText } from './doc';

/**
 * The lead shown under a headline: the story's summary if it has one, otherwise its first
 * paragraph of real text, cut at a word near `max` characters.
 */
export function leadExcerpt(dek: string | null, body: Doc | null, max = 240): string | null {
  const summary = dek?.trim();
  if (summary) return summary;
  const first = body ? firstParagraph(body.content) : null;
  if (!first) return null;
  if (first.length <= max) return first;
  const cut = first.slice(0, max + 1);
  const end = cut.lastIndexOf(' ');
  return `${cut.slice(0, end > max * 0.6 ? end : max).replace(/[\s,;:.–—-]+$/, '')}…`;
}

/** Lines typed as a numbered or bulleted list read badly on their own. */
const LIST_LINE = /^(\d+[.)]|[-•*])\s/;

/** The first paragraph with enough words to read as a lead, skipping datelines, labels and list lines. */
function firstParagraph(blocks: Block[]): string | null {
  for (const b of blocks) {
    if (b.type !== 'paragraph') continue;
    const text = inlineText(b.content).replace(/\s+/g, ' ').trim();
    if (text.split(' ').length >= 8 && !LIST_LINE.test(text)) return text;
  }
  return null;
}
