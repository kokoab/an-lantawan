import { describe, expect, it } from 'vitest';
import {
  readSetting,
  SETTING_GROUPS,
  SETTINGS,
  type SettingKey,
  settingDefaults,
} from './settings';

const form = (fields: Record<string, string | string[]>) => ({
  get: (n: string) => {
    const v = fields[n];
    return v === undefined ? null : Array.isArray(v) ? (v[0] ?? null) : v;
  },
  getAll: (n: string) => {
    const v = fields[n];
    return v === undefined ? [] : Array.isArray(v) ? v : [v];
  },
});
const read = (key: SettingKey, fields: Record<string, string | string[]>) => {
  const f = form(fields);
  return readSetting(key, f.get, f.getAll);
};

describe('settings registry', () => {
  it('puts every setting in a known group', () => {
    const groups = new Set(SETTING_GROUPS.map((g) => g.id));
    for (const def of Object.values(SETTINGS)) expect(groups.has(def.group)).toBe(true);
  });

  it('hands pages the defaults of the keys they ask for', () => {
    expect(settingDefaults('site.name', 'sumat.max_length')).toEqual({
      'site.name': 'An Lantawan',
      'sumat.max_length': 500,
    });
  });
});

describe('readSetting', () => {
  it('trims text and limits its length', () => {
    expect(read('site.tagline', { 'site.tagline': '  Hello  ' })).toEqual({
      ok: true,
      value: 'Hello',
    });
    expect(read('site.tagline', { 'site.tagline': 'x'.repeat(301) }).ok).toBe(false);
  });

  it('only takes https links, or nothing', () => {
    expect(read('site.facebook_url', { 'site.facebook_url': 'https://facebook.com/x' }).ok).toBe(
      true,
    );
    expect(read('site.facebook_url', { 'site.facebook_url': '' }).ok).toBe(true);
    for (const bad of [
      'http://facebook.com',
      'javascript:alert(1)',
      'facebook.com',
      'https://a b',
    ]) {
      expect(read('site.facebook_url', { 'site.facebook_url': bad }).ok).toBe(false);
    }
  });

  it('keeps numbers whole and in range', () => {
    expect(read('sumat.max_length', { 'sumat.max_length': '800' })).toEqual({
      ok: true,
      value: 800,
    });
    for (const bad of ['50', '5000', '12.5', 'lots', '']) {
      expect(read('sumat.max_length', { 'sumat.max_length': bad }).ok).toBe(false);
    }
  });

  it('pairs row fields by position and drops empty rows', () => {
    const r = read('about.contact', {
      'about.contact.label': ['Office', '', ' ', 'Email'],
      'about.contact.text': ['LNU', '', '', ''],
    });
    expect(r).toEqual({
      ok: true,
      value: [
        { label: 'Office', text: 'LNU' },
        { label: 'Email', text: '' },
      ],
    });
  });

  it('reads no rows as an empty list and refuses too many', () => {
    expect(read('about.how_we_work', {})).toEqual({ ok: true, value: [] });
    const many = Array.from({ length: 13 }, (_, i) => `Row ${i}`);
    expect(read('about.how_we_work', { 'about.how_we_work.title': many }).ok).toBe(false);
  });
});
