import { z } from 'zod';

/**
 * Every line of site copy editors can change, with its label in the admin, its default and
 * its rules. Pages read their copy through `settingDefaults`, so a page and the admin can
 * never disagree about a key or its fallback.
 */

export const SETTING_GROUPS = [
  { id: 'site', label: 'Site', note: 'The name, tagline and links used across every page.' },
  { id: 'about', label: 'About page', note: 'Everything on /about except the editorial board.' },
  { id: 'pages', label: 'Page intros', note: 'The line under each page title.' },
  { id: 'sumat', label: 'Sumat', note: 'The words on /sumat and the Sumat block on the homepage.' },
] as const;

export type SettingGroup = (typeof SETTING_GROUPS)[number]['id'];

interface Base<T> {
  label: string;
  group: SettingGroup;
  help?: string;
  default: T;
}
export type RowField = { name: string; label: string; long?: boolean };
type TextDef = Base<string> & { type: 'text' | 'textarea' | 'url' };
type NumberDef = Base<number> & { type: 'number'; min: number; max: number };
type RowsDef = Base<Record<string, string>[]> & { type: 'rows'; fields: RowField[] };
export type SettingDef = TextDef | NumberDef | RowsDef;

const text = (group: SettingGroup, label: string, value: string, help?: string): TextDef => ({
  type: 'text',
  group,
  label,
  default: value,
  help,
});
const long = (group: SettingGroup, label: string, value: string, help?: string): TextDef => ({
  type: 'textarea',
  group,
  label,
  default: value,
  help,
});

const TITLE_TEXT: RowField[] = [
  { name: 'title', label: 'Title' },
  { name: 'text', label: 'Text', long: true },
];

export const SETTINGS = {
  'site.name': text('site', 'Site name', 'An Lantawan'),
  'site.tagline': text('site', 'Tagline', 'Liberating the critical and creative mind.'),
  'site.description': long(
    'site',
    'Short description',
    'The official student publication of Leyte Normal University, Tacloban City.',
    'Shown in the footer and in search results.',
  ),
  'site.place': text('site', 'Place line', 'Leyte Normal University, Tacloban City', 'Footer.'),
  'site.facebook_url': {
    type: 'url',
    group: 'site',
    label: 'Facebook page',
    default: 'https://www.facebook.com/AnLantawanLNU',
  } satisfies TextDef,

  'about.headline': text('about', 'Headline', ''),
  'about.intro': long('about', 'Intro', ''),
  'about.how_we_work': {
    type: 'rows',
    group: 'about',
    label: 'How we work',
    fields: TITLE_TEXT,
    default: [] as Record<string, string>[],
  } satisfies RowsDef,
  'about.contact': {
    type: 'rows',
    group: 'about',
    label: 'Contact',
    fields: [
      { name: 'label', label: 'Label' },
      { name: 'text', label: 'Text', long: true },
    ],
    default: [] as Record<string, string>[],
  } satisfies RowsDef,
  'about.join_title': text('about', 'Join the staff: title', 'Join the staff'),
  'about.join_text': long('about', 'Join the staff: text', ''),
  'about.join_note': text('about', 'Join the staff: note', ''),

  'page.stories.intro': text(
    'pages',
    'All stories',
    'Everything An Lantawan has published, newest first.',
  ),
  'page.explainers.intro': text(
    'pages',
    'Explainers',
    'What a law, a policy or a controversy means for LNU students, explained.',
  ),
  'page.letters.intro': text(
    'pages',
    'Published letters',
    'Letters sent through Sumat that the editorial team chose to publish. Anonymous letters stay anonymous.',
  ),
  'page.print.intro': text(
    'pages',
    'Print issues',
    'Newsletters and special publications, as they were printed. Open any issue to read it as a PDF.',
  ),
  'page.sportsfest.intro': text(
    'pages',
    'Sportsfest, before the first one is set up',
    'The medal tally, results and coverage of LNU Sportsfest.',
  ),
  'page.sportsfest_events.intro': text(
    'pages',
    'Sportsfest: All events',
    'Every medal event, its schedule and its winners. Search by sport, or filter by tribu or day.',
  ),
  'page.sportsfest_past.intro': text(
    'pages',
    'Past Sportsfests',
    'Every Sportsfest we have covered: the champion, the medal tally and the full results.',
  ),

  'sumat.max_length': {
    type: 'number',
    group: 'sumat',
    label: 'Longest message, in characters',
    min: 100,
    max: 3000,
    default: 500,
  } satisfies NumberDef,
  'sumat.description': long(
    'sumat',
    'Description for search and sharing',
    "Say what's on your mind. Sumat is the open line of An Lantawan, the official student publication of Leyte Normal University.",
  ),
  'sumat.note': text(
    'sumat',
    'Line under the Send button',
    'Only the An Lantawan editorial team reads this. Nothing is published without review.',
  ),
  'sumat.how': {
    type: 'rows',
    group: 'sumat',
    label: 'How Sumat works',
    help: 'Keep these accurate: anonymous letters are anonymous, and only editors read them.',
    fields: TITLE_TEXT,
    default: [
      {
        title: 'Anonymous unless you sign it',
        text: 'Choose “With my name” only if you want us to know who wrote.',
      },
      {
        title: 'Read only by the editorial team',
        text: 'Letters go to the editors’ inbox, not to anyone else at LNU.',
      },
      {
        title: 'Nothing is published without review',
        text: 'Some letters run on the site. Anonymous letters stay anonymous.',
      },
    ],
  } satisfies RowsDef,
  'sumat.sent_headline': text(
    'sumat',
    'After sending: headline',
    'Your voice reached the newsroom.',
  ),
  'sumat.sent_body': text('sumat', 'After sending: text', 'Thanks for telling us.'),
  'sumat.closed_headline': text(
    'sumat',
    'When closed: headline',
    'We’re not taking messages right now.',
  ),
  'sumat.closed_body': text(
    'sumat',
    'When closed: text',
    'Follow An Lantawan on Facebook to see when the next prompt opens.',
  ),
  'sumat.home_tagline': text('sumat', 'Homepage block: tagline', 'Write to the editorial team'),
  'sumat.home_note': text('sumat', 'Homepage block: note', 'Anonymous unless you sign it'),
} satisfies Record<string, SettingDef>;

export type SettingKey = keyof typeof SETTINGS;
type ValueOf<K extends SettingKey> = (typeof SETTINGS)[K]['default'];

/** The defaults of some settings, ready for `getSettings`. */
export function settingDefaults<const K extends SettingKey>(...keys: K[]) {
  return Object.fromEntries(keys.map((k) => [k, SETTINGS[k].default])) as {
    [P in K]: ValueOf<P> extends string ? string : ValueOf<P>;
  };
}

const MAX = { text: 300, textarea: 2000 } as const;
const MAX_ROWS = 12;

const schemaFor = (def: SettingDef) => {
  switch (def.type) {
    case 'text':
    case 'textarea':
      return z.string().trim().max(MAX[def.type], `Keep it under ${MAX[def.type]} characters.`);
    case 'url':
      return z
        .string()
        .trim()
        .max(300)
        .refine(
          (v) => v === '' || /^https:\/\/[^\s]+$/.test(v),
          'Use a full link starting with https://',
        );
    case 'number':
      return z.coerce
        .number({ message: 'Enter a number.' })
        .int('Use a whole number.')
        .min(def.min, `Use at least ${def.min}.`)
        .max(def.max, `Use at most ${def.max}.`);
    case 'rows':
      return z
        .array(z.record(z.string(), z.string().trim().max(MAX.textarea)))
        .max(MAX_ROWS, `Use at most ${MAX_ROWS} rows.`);
  }
};

/**
 * Reads one setting from a submitted form. Rows come in as parallel lists, one per field
 * (`about.contact.label`, `about.contact.text`); rows left completely empty are dropped.
 */
export function readSetting(
  key: SettingKey,
  get: (name: string) => string | null,
  getAll: (name: string) => string[],
): { ok: true; value: unknown } | { ok: false; error: string } {
  const def: SettingDef = SETTINGS[key];
  let raw: unknown = get(key) ?? '';
  if (def.type === 'rows') {
    const columns = def.fields.map((f) => getAll(`${key}.${f.name}`));
    const count = Math.max(0, ...columns.map((c) => c.length));
    raw = Array.from({ length: count }, (_, i) =>
      Object.fromEntries(def.fields.map((f, j) => [f.name, (columns[j][i] ?? '').trim()])),
    ).filter((row) => Object.values(row).some((v) => v !== ''));
  }
  const parsed = schemaFor(def).safeParse(raw);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: parsed.error.issues[0]?.message ?? 'Check this field.' };
}
