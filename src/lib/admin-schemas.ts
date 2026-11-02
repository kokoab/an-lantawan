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

export const storyForm = z.object({
  title: text(200, 'Give the story a headline.'),
  slug,
  dek: optionalText(400),
  sectionId: id,
  kind: z.enum(STORY_KINDS, { message: 'Choose what kind of story this is.' }),
  publishedAt: optionalDateTime,
  videoUrl: optionalText(500),
  cartoonOnTop: checkbox,
  writerPhoto: checkbox,
  pinned: checkbox,
  coverId: optionalId,
  body: z.string().max(2_000_000, 'This story is too long to save in one piece.'),
  tags: z.string().max(600),
  creditPerson: z.array(z.string()),
  creditRole: z.array(z.string()),
  eventIds: z.array(z.string()),
});

export const promptForm = z.object({
  text: text(300, 'Write the question students answer.'),
  opensAt: optionalDateTime,
  closesAt: optionalDateTime,
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
