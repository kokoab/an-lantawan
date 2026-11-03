import { z } from 'zod';
import {
  checkbox,
  date,
  email,
  hexColor,
  id,
  optionalDate,
  optionalDateTime,
  optionalId,
  optionalScore,
  optionalText,
  path,
  schoolYear,
  slug,
  text,
  wholeNumber,
} from '../core/forms';
import {
  EVENT_STATUSES,
  EVENT_TYPES,
  ISSUE_KINDS,
  MATCH_STATUSES,
  SPORTSFEST_STATUSES,
  STORY_KINDS,
} from '../db/schema';

/** The section form. */
export const sectionForm = z.object({
  name: text(60, 'Name the section.'),
  slug,
  description: optionalText(300),
  parentId: optionalId,
  sort: wholeNumber(0, 999),
});

const FOCAL_STEPS = [
  '0',
  '0.1',
  '0.2',
  '0.3',
  '0.4',
  '0.5',
  '0.6',
  '0.7',
  '0.8',
  '0.9',
  '1',
] as const;

/** A photo's description, caption, credit and the point to keep in view when cropped. */
export const mediaForm = z.object({
  alt: optionalText(300),
  caption: optionalText(500),
  creditPersonId: optionalId,
  creditText: optionalText(120),
  focalX: z.enum(FOCAL_STEPS).transform(Number),
  focalY: z.enum(FOCAL_STEPS).transform(Number),
});

export const personForm = z.object({
  name: text(80, 'Add their name.'),
  slug,
  bio: optionalText(600),
});

/** Adding someone to a school year's staff from the Staff page. */
export const staffAddForm = z.object({
  name: text(80, 'Add their name.'),
  position: text(80, 'Add their role, like Sports writer.'),
  bio: optionalText(600),
  onBoard: checkbox,
  canEdit: checkbox,
});

/** Editing someone on the Staff page: who they are and their role that year. */
export const staffEditForm = z.object({
  termId: id,
  name: text(80, 'Add their name.'),
  position: text(80, 'Add their role, like Sports writer.'),
  bio: optionalText(600),
  onBoard: checkbox,
  hasProfile: checkbox,
  canEdit: checkbox,
});

export const staffTermForm = z.object({
  personId: id,
  schoolYear,
  position: text(80, 'Add the position, like Editor-in-chief.'),
  sort: wholeNumber(0, 999),
});

export const issueForm = z.object({
  title: text(160, 'Give the issue a title.'),
  slug,
  kind: z.enum(ISSUE_KINDS, { message: 'Choose newsletter or special publication.' }),
  description: optionalText(600),
  publishedOn: date,
});

const names = z.array(z.string().trim().max(80)).max(12);

/** What the story editor sends on every save. Drafts may be unfinished; publishing checks the rest. */
export const storyPayload = z.object({
  sectionId: z.number().int().positive(),
  kind: z.enum(STORY_KINDS),
  title: z.string().trim().max(200, 'Keep the headline under 200 characters.'),
  slug: z.string().trim().toLowerCase().max(80),
  slugAuto: z.boolean(),
  dek: z.string().trim().max(400, 'Keep the summary under 400 characters.'),
  credits: z.object({ writer: names, photographer: names, artist: names }),
  body: z.unknown(),
  coverId: z.number().int().positive().nullable(),
  cartoonOnTop: z.boolean(),
  writerPhoto: z.boolean(),
  videoUrl: z.string().trim().max(500),
  tags: z.array(z.string()).max(20),
  eventIds: z.array(z.number().int().positive()).max(60),
  shareTitle: z.string().trim().max(70, 'Keep the share title to 70 characters.'),
  shareSummary: z.string().trim().max(160, 'Keep the share summary to 160 characters.'),
  pinned: z.boolean(),
  /** When this editor last loaded or saved the story, to notice someone else's save. */
  baseUpdatedAt: z.number().nullable(),
  force: z.boolean().optional(),
});
export type StoryPayload = z.infer<typeof storyPayload>;

export const promptForm = z.object({
  text: text(300, 'Write the question students answer.'),
  opensAt: optionalDateTime,
  closesAt: optionalDateTime,
});

/** The homepage form. `pick` is the story chosen in “Pick the top story”, not yet saved. */
export const homeForm = z.object({
  pin: optionalId,
  pick: optionalId,
  prompt: optionalText(300),
  sumatBand: checkbox,
  banner: checkbox,
});

export const letterForm = z.object({
  text: text(3000, 'The letter can’t be empty.'),
  signature: text(120, 'Add a signature, like Anonymous.'),
  sectionId: id,
  publishedAt: optionalDateTime,
});

export const notesForm = z.object({ notes: optionalText(2000) });

export const tribuForm = z.object({
  name: text(60, 'Name the tribu.'),
  slug,
  color: hexColor,
  sort: wholeNumber(0, 999),
});

export const sportsfestForm = z.object({
  year: wholeNumber(2000, 2100),
  name: text(80, 'Name it, like Sportsfest 2027.'),
  theme: optionalText(200),
  status: z.enum(SPORTSFEST_STATUSES, { message: 'Choose where it stands.' }),
  startsOn: optionalDate,
  endsOn: optionalDate,
  tribuIds: z.array(z.string()),
});

export const eventForm = z.object({
  name: text(80, 'Name the event, like Basketball.'),
  slug,
  type: z.enum(EVENT_TYPES, { message: 'Choose how it is decided.' }),
  status: z.enum(EVENT_STATUSES, { message: 'Choose where it stands.' }),
  venue: optionalText(120),
  startsAt: optionalDateTime,
  note: optionalText(300),
  categories: optionalText(400),
});

export const categoryForm = z.object({
  name: text(60, 'Name the category, like Women’s.'),
  sort: wholeNumber(0, 99),
});

export const matchForm = z.object({
  homeScore: optionalScore,
  awayScore: optionalScore,
  status: z.enum(MATCH_STATUSES),
  startsAt: optionalDateTime,
  venue: optionalText(120),
  homeTribuId: optionalId,
  awayTribuId: optionalId,
});

export const pointsForm = z.object({
  win: z.coerce.number().min(0).max(10),
  draw: z.coerce.number().min(0).max(10),
  loss: z.coerce.number().min(0).max(10),
});

export const editorForm = z.object({
  name: text(80, 'Add their name.'),
  email,
});

export const redirectForm = z.object({ from: path, to: path });
