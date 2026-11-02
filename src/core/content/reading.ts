import type { Block, Doc } from './doc';
import { inlineText } from './doc';

/** Words per minute for a typical reader of news in English or Filipino. */
const WPM = 220;

function blockText(b: Block): string {
  switch (b.type) {
    case 'paragraph':
    case 'heading':
      return inlineText(b.content);
    case 'blockquote':
      return b.content.map(blockText).join(' ');
    case 'bulletList':
    case 'orderedList':
      return b.content.map((li) => li.content.map(blockText).join(' ')).join(' ');
    case 'image':
      return b.attrs.caption;
    default:
      return '';
  }
}

export function wordCount(doc: Doc): number {
  return doc.content
    .map(blockText)
    .join(' ')
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Minutes to read, at least 1. */
export const readingMinutes = (doc: Doc) => Math.max(1, Math.round(wordCount(doc) / WPM));
