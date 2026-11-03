import type { Block, Doc } from './doc';
import { inlineText } from './doc';

export type DiffPart = { op: 'same' | 'added' | 'removed'; text: string };

/** Words with the space after them, so a change reads as whole words. */
const tokens = (s: string) => s.match(/\s*\S+\s*/g) ?? [];

/**
 * Word-by-word changes between two texts, for the version comparison: removed words are
 * struck out, added ones highlighted. Longest-common-subsequence over words.
 */
export function wordDiff(before: string, after: string): DiffPart[] {
  const a = tokens(before);
  const b = tokens(after);
  // Very long texts would make the table huge; compare them whole instead.
  if (a.length * b.length > 400_000) {
    return before === after
      ? [{ op: 'same', text: after }]
      : [
          { op: 'removed', text: before },
          { op: 'added', text: after },
        ];
  }
  const n = a.length;
  const m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: DiffPart[] = [];
  const push = (op: DiffPart['op'], text: string) => {
    const last = out[out.length - 1];
    if (last && last.op === op) last.text += text;
    else out.push({ op, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push('same', a[i]);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) push('removed', a[i++]);
    else push('added', b[j++]);
  }
  while (i < n) push('removed', a[i++]);
  while (j < m) push('added', b[j++]);
  return out;
}

/** The text of each block, labelled the way the editor labels them. */
export function blockTexts(doc: Doc): Array<{ label: string; text: string }> {
  let paragraph = 0;
  const text = (b: Block): string => {
    switch (b.type) {
      case 'paragraph':
      case 'heading':
        return inlineText(b.content);
      case 'blockquote':
        return b.content.map(text).join(' ');
      case 'bulletList':
      case 'orderedList':
        return b.content.map((li) => li.content.map(text).join(' ')).join('\n');
      case 'image':
        return b.attrs.caption;
      case 'infoBox':
        return [b.attrs.title, ...b.attrs.rows.map((r) => `${r.label}: ${r.text}`)].join('\n');
      case 'chart':
        return [b.attrs.title, ...b.attrs.rows.map((r) => `${r.label}: ${r.value}`)].join('\n');
      default:
        return '';
    }
  };
  const LABEL: Record<string, string> = {
    heading: 'Subhead',
    blockquote: 'Pull quote',
    image: 'Photo caption',
    infoBox: 'Info box',
    chart: 'Chart',
    bulletList: 'List',
    orderedList: 'List',
  };
  return doc.content.map((b) => ({
    label: b.type === 'paragraph' ? `Paragraph ${++paragraph}` : (LABEL[b.type] ?? 'Block'),
    text: text(b),
  }));
}

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth'];

/** A short note for the version list: “Changed the headline and first paragraph”. */
export function describeChange(
  before: { title: string; dek: string | null; body: Doc } | null,
  after: { title: string; dek: string | null; body: Doc },
): string {
  if (!before) return 'Started the draft';
  const parts: string[] = [];
  if (before.title !== after.title) parts.push('the headline');
  if ((before.dek ?? '') !== (after.dek ?? '')) parts.push('the summary');
  const a = blockTexts(before.body);
  const b = blockTexts(after.body);
  const photosBefore = before.body.content.filter((x) => x.type === 'image').length;
  const photosAfter = after.body.content.filter((x) => x.type === 'image').length;
  const changedParas = b
    .map((blk, i) => ({ blk, i }))
    .filter(({ blk, i }) => blk.label.startsWith('Paragraph') && a[i]?.text !== blk.text);
  if (changedParas.length === 1) {
    const n = Number(changedParas[0].blk.label.split(' ')[1]);
    parts.push(`${ORDINAL[n - 1] ?? `paragraph ${n}`}${ORDINAL[n - 1] ? ' paragraph' : ''}`);
  } else if (changedParas.length > 1) parts.push(`${changedParas.length} paragraphs`);
  if (photosAfter > photosBefore) {
    return parts.length ? `Added a photo and changed ${join(parts)}` : 'Added a photo';
  }
  if (photosAfter < photosBefore) parts.push('the photos');
  if (!parts.length && a.length !== b.length) return 'Changed the story layout';
  return parts.length ? `Changed ${join(parts)}` : 'Saved without changes';
}

const join = (parts: string[]) =>
  parts.length <= 1
    ? (parts[0] ?? '')
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
