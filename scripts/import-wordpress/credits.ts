/**
 * Finds the credit lines WordPress posts carry in their text ("Layout by …", "Kartun ni …",
 * "via … | An Lantawan News") and turns them into bylines, removing them from the story.
 */
import type { Block, Doc, Inline, Paragraph } from '../../src/core/content/doc.ts';

export type Role = 'writer' | 'photographer' | 'artist';

export interface Credit {
  name: string;
  role: Role;
}

// Phrases that introduce a credit, English and Filipino ("ni" = by, "kuha ni" = taken by).
const ROLE_PHRASES: Array<[Role, string]> = [
  ['photographer', String.raw`photo(?:graph)?s?\s+(?:by|courtesy(?:\s+of)?)|kuha\s+ni`],
  [
    'artist',
    String.raw`(?:layouts?|cartoons?|kartun|illustrations?|graphics?|art(?:work)?|pubmat|editorial\s+cartoon)\s+(?:by|ni)`,
  ],
  [
    'writer',
    String.raw`(?:written|words|story|article|report(?:ed)?|compiled|explainer|column|op-?ed|news|feature|editorial|essay|review)\s+by|(?:opinyon|kolum|sinulat|isinulat|balita|sanaysay|tula)\s+ni|by|ni|via`,
  ],
];
const PHRASE = new RegExp(
  `(?:^|\\s|,|;)(${ROLE_PHRASES.map(([, p]) => `(?:${p})`).join('|')})\\s*:?\\s+`,
  'gi',
);

/** "Annie Lianza – BAComm Intern", "M.E. Student": who someone is, not a separate person. */
const DESCRIPTION = /\b(?:student|intern|writer|editor|correspondent|contributor)\b/i;
const roleOf = (phrase: string): Role => {
  for (const [role, p] of ROLE_PHRASES)
    if (new RegExp(`^(?:${p})$`, 'i').test(phrase.trim())) return role;
  return 'writer';
};

/**
 * Sign-offs such as "| An Lantawan Creatives", "/AnLantawan" or "l An Lantawam News"
 * (a typed L standing in for the pipe).
 */
const SIGN_OFF = /\s*(?:\||\/|\s[lI]\s)\s*an\s*lantawa[nm]\b[^|]*/gi;

const NAME_WORD =
  /^(?:[A-ZÑ][a-zà-ÿñ'’]+(?:-[A-ZÑ]?[a-zà-ÿñ'’]+)*\.?|[A-Z]\.|[A-Z]{2,3}\.?|(?:de|dela|del|delos|la|y)|Jr\.?|Sr\.?|II|III|IV)$/;

/** A plausible person's name: 2 to 7 words, each capitalised (particles like "dela" allowed). */
export function looksLikeName(text: string): boolean {
  if (/\blantawa[nm]\b/i.test(text) || /^(?:by|ni|via)\s/i.test(text)) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 7 || text.length > 50) return false;
  const capitalised = words.filter((w) => /^[A-ZÑ]/.test(w));
  if (capitalised.length < 2) return false;
  // All-caps organisation names ("LNU OSA") are not people.
  if (words.filter((w) => /^[A-Z]{2,}$/.test(w)).length >= 2) return false;
  return words.every((w) => NAME_WORD.test(w));
}

/** Three- or four-letter all-caps words like "LNU" or "DOH" mark an organisation. Initials like "AJ" don't. */
const ACRONYM = /\b(?!(?:III|JR|SR)\b)[A-Z]{3,4}\b/;

/** Title-cases names typed in all caps or all lowercase; leaves mixed case alone. */
export function tidyName(raw: string): string {
  const name = raw
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .replace(/[,;:]+$/, '')
    // A full stop ends a sentence, except after an initial, "Jr", "Sr" or "Ma." (Maria).
    .replace(/(?<!\b(?:\p{Lu}|Jr|Sr|Ma))\.$/u, '')
    .trim();
  if (name !== name.toUpperCase() && name !== name.toLowerCase()) return name;
  return name.toLowerCase().replace(/(^|[\s-])([a-zà-ÿñ])/g, (_, sep, c) => sep + c.toUpperCase());
}

/**
 * Credits in one line of text, and whether the whole line is credits (so it can be
 * removed from the story). Lines with anything else in them are left alone.
 */
export function parseCreditLine(line: string): { credits: Credit[]; onlyCredits: boolean } {
  const text = line
    .replace(SIGN_OFF, ' ')
    .replace(/^\((.*)\)$/, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  const matches = [...text.matchAll(PHRASE)];
  if (!matches.length) return { credits: [], onlyCredits: false };

  const before = text.slice(0, matches[0].index).trim();
  const credits: Credit[] = [];
  let leftover = before;
  matches.forEach((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const role = roleOf(m[1]);
    const names = text
      .slice(start, end)
      .replace(/[|]+.*$/, '')
      .replace(/\s+[–—]\s+.*$/, '')
      .split(/\s*(?:,|&|\band\b|\bat\b|\/)\s*/i)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const raw of names) {
      const n = tidyName(raw);
      if (!ACRONYM.test(raw) && looksLikeName(n)) credits.push({ name: n, role });
      else if (!DESCRIPTION.test(raw)) leftover += ` ${n}`;
    }
  });
  return { credits, onlyCredits: credits.length > 0 && leftover.trim() === '' };
}

function splitLines(content: Inline[] | undefined): string[] {
  const lines = [''];
  for (const n of content ?? []) {
    if (n.type === 'hardBreak') lines.push('');
    else lines[lines.length - 1] += n.text;
  }
  return lines.map((l) => l.trim()).filter(Boolean);
}

/** A paragraph that only credits a photo, like the line WordPress posts put under images. */
function isPhotoCredit(content: Inline[] | undefined): boolean {
  const lines = splitLines(content);
  if (lines.length !== 1 || lines[0].length > 200) return false;
  const parsed = parseCreditLine(lines[0]);
  return parsed.onlyCredits && parsed.credits.every((c) => c.role === 'photographer');
}

/**
 * A first paragraph that is only a name ("Troy Ortega"), followed by the story itself,
 * is the writer's byline written without "by".
 */
function isBareName(line: string, next: Block | undefined): boolean {
  const nextText = next?.type === 'paragraph' ? splitLines(next.content).join(' ') : '';
  return (
    line.length <= 50 &&
    !ACRONYM.test(line) &&
    looksLikeName(tidyName(line)) &&
    nextText.length > 80
  );
}

/**
 * Removes a credits-only first line from a longer paragraph ("By Lea Bejar / University
 * President …"). Returns true if the paragraph is left empty.
 */
function takeLeadingCreditLine(block: Paragraph, credits: Credit[]): boolean {
  const content = block.content ?? [];
  const breakAt = content.findIndex((n) => n.type === 'hardBreak');
  if (breakAt < 1) return false;
  const first = splitLines(content.slice(0, breakAt))[0] ?? '';
  const parsed = parseCreditLine(first);
  if (!parsed.onlyCredits) return false;
  credits.push(...parsed.credits);
  block.content = content.slice(breakAt + 1);
  return splitLines(block.content).length === 0;
}

/** How far into the start and end of a story to look for credit lines. */
const EDGE = 4;

/**
 * Pulls credits from the first and last few paragraphs. Paragraphs made only of credits
 * are removed; everything else stays exactly as it was.
 */
export function extractCredits(doc: Doc): { doc: Doc; credits: Credit[] } {
  const credits: Credit[] = [];
  const n = doc.content.length;
  const firstText = doc.content.findIndex((b) => b.type === 'paragraph');
  const content = doc.content.filter((block: Block, i) => {
    if (block.type !== 'paragraph') return true;
    const prev = doc.content[i - 1];
    if (prev?.type === 'image' && isPhotoCredit(block.content)) {
      const credit = splitLines(block.content).join(' ');
      prev.attrs.caption = [prev.attrs.caption, credit].filter(Boolean).join(' ');
      return false;
    }
    if (i >= EDGE && i < n - EDGE) return true;
    const lines = splitLines(block.content);
    if (!lines.length || lines.some((l) => l.length > 200)) {
      // A byline sharing a paragraph with the story's first sentence, split by a line break.
      return !takeLeadingCreditLine(block, credits);
    }
    if (i === firstText && lines.length === 1 && isBareName(lines[0], doc.content[i + 1])) {
      credits.push({ name: tidyName(lines[0]), role: 'writer' });
      return false;
    }
    const parsed = lines.map(parseCreditLine);
    if (parsed.every((p) => p.onlyCredits)) {
      for (const p of parsed) credits.push(...p.credits);
      return false;
    }
    return !takeLeadingCreditLine(block, credits);
  });

  const seen = new Set<string>();
  const unique = credits.filter((c) => {
    const k = `${c.role}:${c.name.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { doc: { ...doc, content }, credits: unique };
}
