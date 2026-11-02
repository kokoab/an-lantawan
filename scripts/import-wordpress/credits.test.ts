import { describe, expect, it } from 'vitest';
import type { Doc } from '../../src/core/content/doc.ts';
import { extractCredits, looksLikeName, parseCreditLine, tidyName } from './credits.ts';

describe('parseCreditLine', () => {
  it.each([
    ['Layout by Yuri Zetth Llava | An Lantawan Creatives', [['Yuri Zetth Llava', 'artist']]],
    [
      'Layout by Francis Angelo Batiancela | An Lantawam Creatives',
      [['Francis Angelo Batiancela', 'artist']],
    ],
    ['Kartun ni Ronron Fernandez | An Lantawan Creatives', [['Ronron Fernandez', 'artist']]],
    ['ni John Lord Reyes', [['John Lord Reyes', 'writer']]],
    ['Opinyon ni Niel Labnotin | An Lantawan Opinion', [['Niel Labnotin', 'writer']]],
    [
      'via Rochelle Morilla & Princess Calderon | An Lantawan News',
      [
        ['Rochelle Morilla', 'writer'],
        ['Princess Calderon', 'writer'],
      ],
    ],
    [
      'By Gil Romero and Emerson Obillo',
      [
        ['Gil Romero', 'writer'],
        ['Emerson Obillo', 'writer'],
      ],
    ],
    [
      'Photo by Willan Badidles, Layout by Kian Nartea',
      [
        ['Willan Badidles', 'photographer'],
        ['Kian Nartea', 'artist'],
      ],
    ],
    ['Photos by Ivar Dominique Roa', [['Ivar Dominique Roa', 'photographer']]],
    ['Words by JANAYA VILLANUEVA', [['Janaya Villanueva', 'writer']]],
    ['by Maria dela Cruz', [['Maria dela Cruz', 'writer']]],
    [
      'Explainer by Yuri Zetth Llava and Nerie An Pombo | An Lantawan News',
      [
        ['Yuri Zetth Llava', 'writer'],
        ['Nerie An Pombo', 'writer'],
      ],
    ],
    ['Column by Jayrald Mejia | An Lantawan Opinion', [['Jayrald Mejia', 'writer']]],
    ['Op-Ed by Troy Ortega', [['Troy Ortega', 'writer']]],
    ['News by Daniel Panis/AnLantawan', [['Daniel Panis', 'writer']]],
    ['Via Russel Nogal l An Lantawan News', [['Russel Nogal', 'writer']]],
    ['via AJ Mercurio | An Lantawan News', [['AJ Mercurio', 'writer']]],
    [
      'By Giselle-Ann Padilla and Janaya Villanueva | An Lantawan News',
      [
        ['Giselle-Ann Padilla', 'writer'],
        ['Janaya Villanueva', 'writer'],
      ],
    ],
    [
      '(Story by Darlin Mae Margate and Raymond Negros)',
      [
        ['Darlin Mae Margate', 'writer'],
        ['Raymond Negros', 'writer'],
      ],
    ],
    ['Photo by Cyrus Delloro | An Lantawan Multimedia', [['Cyrus Delloro', 'photographer']]],
    ['Photo Courtesy: Gio Marion Artiga Costuna', [['Gio Marion Artiga Costuna', 'photographer']]],
    ['Compiled by Carl Jeffrey Egoy', [['Carl Jeffrey Egoy', 'writer']]],
    ['By Annie Lianza – BAComm Intern', [['Annie Lianza', 'writer']]],
    ['by Robertgie L. Piañar, M.E. Student', [['Robertgie L. Piañar', 'writer']]],
    ['by Marizthela Jhulie Ann G. De la Cruz', [['Marizthela Jhulie Ann G. De la Cruz', 'writer']]],
  ])('%s', (line, expected) => {
    const r = parseCreditLine(line);
    expect(r.credits.map((c) => [c.name, c.role])).toEqual(expected);
    expect(r.onlyCredits).toBe(true);
  });

  it('does not treat sentences that mention "by" as credits', () => {
    expect(
      parseCreditLine('Inducted by Dr. Aguirre, the elected SSC officers took their oath.')
        .onlyCredits,
    ).toBe(false);
    expect(
      parseCreditLine('The event was attended by students from all colleges.').onlyCredits,
    ).toBe(false);
  });

  it('does not credit organisations', () => {
    expect(parseCreditLine('Photo courtesy of LNU OSA').onlyCredits).toBe(false);
  });
});

describe('looksLikeName', () => {
  it('accepts names with particles and initials', () => {
    expect(looksLikeName('Juan dela Cruz')).toBe(true);
    expect(looksLikeName('Clyde Sam Lequin')).toBe(true);
    expect(looksLikeName('Ma. Teresa B. Santos')).toBe(true);
  });
  it('rejects the publication and lines that still start with "by"', () => {
    expect(looksLikeName('An Lantawan News')).toBe(false);
    expect(looksLikeName('By Carmela P. Caminong')).toBe(false);
  });
  it('rejects single words and long phrases', () => {
    expect(looksLikeName('Juan')).toBe(false);
    expect(looksLikeName('the National Institute of Allergy and Infectious Diseases')).toBe(false);
  });
});

describe('tidyName', () => {
  it('title-cases all-caps names only', () => {
    expect(tidyName('NERIE ANN POMBO')).toBe('Nerie Ann Pombo');
    expect(tidyName('Juan dela Cruz')).toBe('Juan dela Cruz');
  });
  it('drops a sentence full stop but keeps one that belongs to the name', () => {
    expect(tidyName('Ivar Roa.')).toBe('Ivar Roa');
    expect(tidyName('Danilo Sajorda Jr.')).toBe('Danilo Sajorda Jr.');
    expect(tidyName('Lea D.')).toBe('Lea D.');
  });
});

describe('extractCredits', () => {
  const p = (text: string) => ({
    type: 'paragraph' as const,
    content: [{ type: 'text' as const, text }],
  });

  it('removes credit-only paragraphs at the start and end and keeps the rest', () => {
    const doc: Doc = {
      type: 'doc',
      content: [
        p('Layout by Kian Nartea'),
        p('The story begins.'),
        p('It ends.'),
        p('By Gil Romero'),
      ],
    };
    const r = extractCredits(doc);
    expect(r.credits).toEqual([
      { name: 'Kian Nartea', role: 'artist' },
      { name: 'Gil Romero', role: 'writer' },
    ]);
    expect(r.doc.content).toEqual([p('The story begins.'), p('It ends.')]);
  });

  it('reads a bare name before the story as the writer', () => {
    const story = p(
      'The 2022 Eastern Visayas SCUAA Meet is the first-ever regional games of the association after two academic years.',
    );
    const r = extractCredits({ type: 'doc', content: [p('Troy Ortega'), story] });
    expect(r.credits).toEqual([{ name: 'Troy Ortega', role: 'writer' }]);
    expect(r.doc.content).toEqual([story]);
  });

  it('takes a byline off the top of a paragraph and keeps the rest', () => {
    const block = {
      type: 'paragraph' as const,
      content: [
        { type: 'text' as const, text: 'By Lea Bejar and Danilo Sajorda Jr.' },
        { type: 'hardBreak' as const },
        { type: 'text' as const, text: 'University President Evelyn B. Aguirre is hopeful.' },
      ],
    };
    const r = extractCredits({ type: 'doc', content: [block] });
    expect(r.credits.map((c) => c.name)).toEqual(['Lea Bejar', 'Danilo Sajorda Jr.']);
    expect(r.doc.content).toEqual([p('University President Evelyn B. Aguirre is hopeful.')]);
  });

  it('moves a photo credit under a photo into its caption', () => {
    const img = {
      type: 'image' as const,
      attrs: { mediaId: null, key: null, alt: '', caption: '' },
    };
    const middle = Array.from({ length: 10 }, (_, i) => p(`Paragraph ${i}`));
    middle.splice(5, 0, img, p('Photo by Cyrus Delloro | An Lantawan Multimedia'));
    const r = extractCredits({ type: 'doc', content: middle });
    expect(r.doc.content).toHaveLength(11);
    expect(img.attrs.caption).toBe('Photo by Cyrus Delloro | An Lantawan Multimedia');
    expect(r.credits).toEqual([]);
  });

  it('leaves credit-like lines in the middle of a long story alone', () => {
    const middle = Array.from({ length: 10 }, (_, i) => p(`Paragraph ${i}`));
    middle[5] = p('By Gil Romero');
    expect(extractCredits({ type: 'doc', content: middle }).credits).toEqual([]);
  });
});
