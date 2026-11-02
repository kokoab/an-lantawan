import { z } from 'zod';
import {
  checkbox,
  date,
  id,
  optionalDateTime,
  optionalId,
  optionalText,
  schoolYear,
  slug,
  text,
  wholeNumber,
} from '../core/forms';
import { ISSUE_KINDS, STORY_KINDS } from '../db/schema';

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
