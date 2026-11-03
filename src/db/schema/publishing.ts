import {
  type AnySQLiteColumn,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { archivedAt, createdAt, id, oneOf, timestamp } from './columns';
import { editors } from './site';
import { sumatMessages } from './sumat';

/** Anyone credited on the site: writers, photographers, artists, staff. Includes alumni. */
export const people = sqliteTable('people', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  bio: text('bio'),
  photoId: integer('photo_id').references((): AnySQLiteColumn => media.id, {
    onDelete: 'set null',
  }),
  /** Shown on “Who’s editing?” after signing in with the publication account. */
  canEdit: integer('can_edit', { mode: 'boolean' }).notNull().default(false),
  createdAt: createdAt(),
  archivedAt: archivedAt(),
});

/** One row per position held in a school year. The editorial board page reads these. */
export const staffTerms = sqliteTable(
  'staff_terms',
  {
    id: id(),
    personId: integer('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    schoolYear: text('school_year').notNull(),
    position: text('position').notNull(),
    sort: integer('sort').notNull().default(0),
  },
  (t) => [uniqueIndex('staff_terms_unique').on(t.personId, t.schoolYear, t.position)],
);

/** News, Opinion, Features, Sports, and subsections such as Sci-Tech under Features. */
export const sections = sqliteTable('sections', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  parentId: integer('parent_id').references((): AnySQLiteColumn => sections.id, {
    onDelete: 'restrict',
  }),
  sort: integer('sort').notNull().default(0),
  archivedAt: archivedAt(),
});

export const MEDIA_KINDS = ['image', 'pdf'] as const;

/** Files stored in R2. `key` is the object name in the bucket. */
export const media = sqliteTable(
  'media',
  {
    id: id(),
    key: text('key').notNull().unique(),
    kind: text('kind', { enum: MEDIA_KINDS }).notNull(),
    mime: text('mime').notNull(),
    bytes: integer('bytes').notNull(),
    width: integer('width'),
    height: integer('height'),
    alt: text('alt'),
    caption: text('caption'),
    creditPersonId: integer('credit_person_id').references((): AnySQLiteColumn => people.id, {
      onDelete: 'set null',
    }),
    /** Credit for someone outside the publication, e.g. "Photo from LNU OSA". */
    creditText: text('credit_text'),
    focalX: real('focal_x').notNull().default(0.5),
    focalY: real('focal_y').notNull().default(0.5),
    uploadedBy: integer('uploaded_by').references(() => editors.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [oneOf('media_kind', t.kind, MEDIA_KINDS)],
);

export const STORY_KINDS = [
  'article',
  'opinion',
  'editorial',
  'cartoon',
  'explainer',
  'photo',
  'video',
  'letter',
] as const;
export const STORY_STATUSES = ['draft', 'scheduled', 'published', 'archived'] as const;

export const stories = sqliteTable(
  'stories',
  {
    id: id(),
    sectionId: integer('section_id')
      .notNull()
      .references(() => sections.id, { onDelete: 'restrict' }),
    kind: text('kind', { enum: STORY_KINDS }).notNull().default('article'),
    status: text('status', { enum: STORY_STATUSES }).notNull().default('draft'),
    title: text('title').notNull(),
    slug: text('slug').notNull().unique(),
    dek: text('dek'),
    /** Editor blocks as JSON (paragraphs, photos, quotes, info boxes, charts). */
    body: text('body', { mode: 'json' }).notNull(),
    coverId: integer('cover_id').references(() => media.id, { onDelete: 'set null' }),
    /** Opinion pieces: show the cartoon on top, and the writer's photo in the author box. */
    cartoonOnTop: integer('cartoon_on_top', { mode: 'boolean' }).notNull().default(false),
    writerPhoto: integer('writer_photo', { mode: 'boolean' }).notNull().default(false),
    videoUrl: text('video_url'),
    /** What Facebook and Messenger show when the story is shared; the headline and summary if empty. */
    shareTitle: text('share_title'),
    shareSummary: text('share_summary'),
    /** The staff member who saved it last. */
    updatedByPersonId: integer('updated_by_person_id').references(
      (): AnySQLiteColumn => people.id,
      {
        onDelete: 'set null',
      },
    ),
    publishedAt: integer('published_at', { mode: 'timestamp' }),
    scheduledFor: integer('scheduled_for', { mode: 'timestamp' }),
    updatedAt: timestamp('updated_at'),
    createdAt: createdAt(),
    /** The Sumat message a published letter came from. */
    sourceMessageId: integer('source_message_id')
      .unique()
      .references(() => sumatMessages.id, { onDelete: 'set null' }),
    /** WordPress post ID, so the import can be re-run without duplicating stories. */
    wpId: integer('wp_id').unique(),
  },
  (t) => [
    oneOf('stories_kind', t.kind, STORY_KINDS),
    oneOf('stories_status', t.status, STORY_STATUSES),
    index('stories_feed').on(t.status, t.publishedAt),
    index('stories_section_feed').on(t.sectionId, t.status, t.publishedAt),
  ],
);

export const CREDIT_ROLES = ['writer', 'photographer', 'artist', 'editor'] as const;

/** Bylines. A story can have several people, a person many stories. */
export const storyAuthors = sqliteTable(
  'story_authors',
  {
    storyId: integer('story_id')
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    personId: integer('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'restrict' }),
    role: text('role', { enum: CREDIT_ROLES }).notNull().default('writer'),
    sort: integer('sort').notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.storyId, t.personId, t.role] }),
    oneOf('story_authors_role', t.role, CREDIT_ROLES),
    index('story_authors_person').on(t.personId),
  ],
);

export const tags = sqliteTable('tags', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
});

export const storyTags = sqliteTable(
  'story_tags',
  {
    storyId: integer('story_id')
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.storyId, t.tagId] }), index('story_tags_tag').on(t.tagId)],
);

/** Every file a story uses, kept in sync on save. Blocks deleting a photo that is still in use. */
export const storyMedia = sqliteTable(
  'story_media',
  {
    storyId: integer('story_id')
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    mediaId: integer('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'restrict' }),
  },
  (t) => [
    primaryKey({ columns: [t.storyId, t.mediaId] }),
    index('story_media_media').on(t.mediaId),
  ],
);

/** A snapshot on every save, for version history and restore. */
export const storyVersions = sqliteTable(
  'story_versions',
  {
    id: id(),
    storyId: integer('story_id')
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    dek: text('dek'),
    body: text('body', { mode: 'json' }).notNull(),
    savedBy: integer('saved_by').references(() => editors.id, { onDelete: 'set null' }),
    personId: integer('person_id').references(() => people.id, { onDelete: 'set null' }),
    /** What changed, in a few words: “Changed the headline and first paragraph”. */
    note: text('note'),
    savedAt: timestamp('saved_at'),
  },
  (t) => [index('story_versions_story').on(t.storyId, t.savedAt)],
);

export const ISSUE_KINDS = ['newsletter', 'special'] as const;

/** Print issues: newsletters and special publications, as PDFs. */
export const issues = sqliteTable(
  'issues',
  {
    id: id(),
    kind: text('kind', { enum: ISSUE_KINDS }).notNull(),
    title: text('title').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    publishedOn: text('published_on').notNull(),
    pdfId: integer('pdf_id')
      .notNull()
      .references(() => media.id, { onDelete: 'restrict' }),
    coverId: integer('cover_id').references(() => media.id, { onDelete: 'set null' }),
    archivedAt: archivedAt(),
  },
  (t) => [oneOf('issues_kind', t.kind, ISSUE_KINDS)],
);

/** Who has a story open right now, so others see “Ana Reyes is also editing”. */
export const storyPresence = sqliteTable(
  'story_presence',
  {
    storyId: integer('story_id')
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    personId: integer('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    seenAt: timestamp('seen_at'),
  },
  (t) => [primaryKey({ columns: [t.storyId, t.personId] })],
);
