import { describe, expect, it } from 'vitest';
import { classify, cleanTitle, slugify } from './classify.ts';

describe('cleanTitle', () => {
  it('decodes entities and folds styled Unicode letters', () => {
    expect(cleanTitle('𝗚𝗼𝗹𝗱𝗲𝗻 𝗙𝗮𝗹𝗰𝗼𝗻𝘀 eyes &#8216;𝟮𝟰').title).toBe('Golden Falcons eyes ‘24');
  });

  it('strips explainer prefixes and reports them', () => {
    expect(cleanTitle('AL EXPLAINER: What RA 9344 Says')).toEqual({
      title: 'What RA 9344 Says',
      explainer: true,
    });
    expect(cleanTitle('[EXPLAINER] Breaking Down the Bill')).toEqual({
      title: 'Breaking Down the Bill',
      explainer: true,
    });
    expect(cleanTitle('Beyond just protocol').explainer).toBe(false);
  });
});

describe('classify', () => {
  it.each([
    [['NEWS'], 'news', 'article'],
    [['COMMENTARIES'], 'opinion', 'opinion'],
    [['EDITORIAL', 'SPECIAL PUBLICATION'], 'opinion', 'editorial'],
    [['Literary'], 'features', 'article'],
    [['SCIE-TECH'], 'sci-tech', 'article'],
    [['NEWS', 'SPORTS'], 'sports', 'article'],
    [['COMMENTARIES', 'NEWS'], 'opinion', 'opinion'],
    [['EXPLAINER'], 'news', 'explainer'],
    [['Videos'], 'news', 'video'],
  ])('%j → %s, %s', (cats, section, kind) => {
    expect(classify(cats, false)).toMatchObject({ section, kind, needsReview: false });
  });

  it('files posts with no useful category under News and flags them', () => {
    expect(classify(['Uncategorized'], false)).toMatchObject({
      section: 'news',
      needsReview: true,
    });
    expect(classify(['SPECIAL PUBLICATION'], false)).toMatchObject({
      section: 'news',
      needsReview: true,
    });
  });

  it('tags special publication stories', () => {
    expect(classify(['NEWS', 'SPECIAL PUBLICATION'], false).tags).toEqual(['Special publication']);
  });

  it('makes a titled explainer an explainer in its own section', () => {
    expect(classify(['NEWS'], true)).toMatchObject({ section: 'news', kind: 'explainer' });
  });
});

describe('slugify', () => {
  it('keeps letters and digits only', () => {
    expect(slugify('Golden Falcons eye EV SCUAA ’24!')).toBe('golden-falcons-eye-ev-scuaa-24');
    expect(slugify('Niño Señor')).toBe('nino-senor');
  });
});
