import { describe, expect, it } from 'vitest';
import { leadShape } from './photo';

describe('leadShape', () => {
  it('runs wide photos full width at the nearest standard shape', () => {
    expect(leadShape(1600, 900)).toEqual({ layout: 'wide', ratio: '16x9' });
    expect(leadShape(1200, 800)).toEqual({ layout: 'wide', ratio: '3x2' });
    expect(leadShape(1400, 1050)).toEqual({ layout: 'wide', ratio: '4x3' });
  });

  it('keeps panoramas at 2:1 and near-square wide photos at 4:3', () => {
    expect(leadShape(4000, 1000)).toEqual({ layout: 'wide', ratio: '2x1' });
    expect(leadShape(1300, 1000)).toEqual({ layout: 'wide', ratio: '4x3' });
  });

  it('puts square and tall pictures beside the text', () => {
    expect(leadShape(1080, 1080)).toEqual({ layout: 'side', ratio: '1x1' });
    expect(leadShape(1080, 1350)).toEqual({ layout: 'side', ratio: '4x5' });
    expect(leadShape(1000, 2000)).toEqual({ layout: 'side', ratio: '2x3' });
    expect(leadShape(1200, 1000)).toEqual({ layout: 'side', ratio: '1x1' });
  });

  it('treats a photo without known size as a standard wide photo', () => {
    expect(leadShape(null, 600)).toEqual({ layout: 'wide', ratio: '16x9' });
  });
});
