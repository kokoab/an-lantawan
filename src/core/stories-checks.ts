import type { Block, Doc } from './content/doc';
import { inlineText } from './content/doc';

/** Cards cut headlines at about this many characters. */
export const HEADLINE_CARD_LIMIT = 90;

export type CheckLevel = 'problem' | 'warning' | 'ok';
export interface Check {
  id: string;
  level: CheckLevel;
  text: string;
  /** What the fix button says, when there is one. */
  fix?: string;
}

export interface CheckableStory {
  title: string;
  dek: string | null;
  sectionId: number | null;
  slug: string;
  body: Doc;
  writers: number;
  cover: { alt: string | null } | null;
  /** Opinion cartoons and photo stories can run with no text. */
  needsText: boolean;
}

const hasText = (blocks: Block[]) =>
  blocks.some(
    (b) =>
      (b.type === 'paragraph' || b.type === 'heading') && inlineText(b.content).trim().length > 0,
  );

/**
 * What “Before you publish” lists. Problems block publishing; warnings don't. The order is
 * problems, then warnings, then what is already fine.
 */
export function publishChecks(s: CheckableStory): Check[] {
  const checks: Check[] = [];
  if (!s.title.trim())
    checks.push({
      id: 'title',
      level: 'problem',
      text: 'The story needs a headline.',
      fix: 'Add it',
    });
  if (s.cover && !s.cover.alt?.trim()) {
    checks.push({
      id: 'alt',
      level: 'problem',
      text: 'The cover photo needs a description for people who can’t see it.',
      fix: 'Add it',
    });
  }
  if (s.needsText && !hasText(s.body.content)) {
    checks.push({
      id: 'body',
      level: 'problem',
      text: 'The story has no text yet.',
      fix: 'Write it',
    });
  }
  const missingAlt = s.body.content.filter((b) => b.type === 'image' && !b.attrs.alt.trim()).length;
  if (missingAlt) {
    checks.push({
      id: 'photo-alt',
      level: 'warning',
      text: `${missingAlt === 1 ? 'A photo' : `${missingAlt} photos`} in the story ${missingAlt === 1 ? 'has' : 'have'} no description.`,
      fix: 'Add it',
    });
  }
  if (s.title.length > HEADLINE_CARD_LIMIT) {
    checks.push({
      id: 'long-title',
      level: 'warning',
      text: `The headline is ${s.title.length} characters. Cards cut it at about ${HEADLINE_CARD_LIMIT}.`,
      fix: 'Shorten',
    });
  }
  const basics = s.sectionId !== null && Boolean(s.dek?.trim()) && s.writers > 0;
  checks.push(
    basics
      ? { id: 'basics', level: 'ok', text: 'Section, summary and byline are set.' }
      : {
          id: 'basics',
          level: 'warning',
          text: 'Add a section, a summary and who wrote it, so the story reads well in lists.',
          fix: 'Add them',
        },
  );
  if (s.slug.trim()) {
    checks.push({
      id: 'link',
      level: 'ok',
      text: 'The link is set. It can’t change after publishing without breaking shared links.',
    });
  }
  if (s.cover?.alt?.trim())
    checks.push({ id: 'crop', level: 'ok', text: 'The photo crops keep the focal point in view.' });
  const order: Record<CheckLevel, number> = { problem: 0, warning: 1, ok: 2 };
  return checks.sort((a, b) => order[a.level] - order[b.level]);
}

export const canPublish = (checks: Check[]) => checks.every((c) => c.level !== 'problem');
