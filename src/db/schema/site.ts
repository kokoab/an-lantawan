import { type AnySQLiteColumn, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { archivedAt, createdAt, id, oneOf, timestamp } from './columns';
import { sections } from './publishing';

/** People who sign in to the admin. Separate from `people`, who get bylines. */
export const editors = sqliteTable('editors', {
  id: id(),
  name: text('name').notNull(),
  email: text('email'),
  createdAt: createdAt(),
  archivedAt: archivedAt(),
});

/** Every editable line of site copy that isn't a story: tagline, footer text, page intros. */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
  updatedAt: timestamp('updated_at'),
  updatedBy: integer('updated_by').references(() => editors.id, { onDelete: 'set null' }),
});

export const MENU_GROUPS = [
  'header',
  'sections',
  'sportsfest',
  'publication',
  'write',
  'footer',
] as const;

/** Header, menu panel and footer links. A link points at a section or at any path. */
export const menuItems = sqliteTable(
  'menu_items',
  {
    id: id(),
    group: text('group', { enum: MENU_GROUPS }).notNull(),
    label: text('label').notNull(),
    href: text('href'),
    sectionId: integer('section_id').references((): AnySQLiteColumn => sections.id, {
      onDelete: 'cascade',
    }),
    sort: integer('sort').notNull().default(0),
  },
  (t) => [
    oneOf('menu_items_group', t.group, MENU_GROUPS),
    index('menu_items_group_sort').on(t.group, t.sort),
  ],
);

/** Old URLs (WordPress, renamed slugs) that answer with a permanent redirect. */
export const redirects = sqliteTable('redirects', {
  fromPath: text('from_path').primaryKey(),
  toPath: text('to_path').notNull(),
  createdAt: createdAt(),
});

/** Who did what in the admin. `entityType` + `entityId` name the row that changed. */
export const activityLog = sqliteTable(
  'activity_log',
  {
    id: id(),
    editorId: integer('editor_id').references(() => editors.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: integer('entity_id'),
    summary: text('summary').notNull(),
    at: timestamp('at'),
  },
  (t) => [
    index('activity_log_at').on(t.at),
    index('activity_log_entity').on(t.entityType, t.entityId),
  ],
);
