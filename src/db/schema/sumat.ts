import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createdAt, id, oneOf, timestamp } from './columns';

/** The question shown on /sumat. The newest open prompt is the current one. */
export const sumatPrompts = sqliteTable('sumat_prompts', {
  id: id(),
  text: text('text').notNull(),
  opensAt: integer('opens_at', { mode: 'timestamp' }).notNull(),
  closesAt: integer('closes_at', { mode: 'timestamp' }),
  createdAt: createdAt(),
});

export const SENT_AS = ['anonymous', 'named'] as const;
export const MESSAGE_STATUSES = ['new', 'shortlisted', 'published', 'archived'] as const;

export const sumatMessages = sqliteTable(
  'sumat_messages',
  {
    id: id(),
    promptId: integer('prompt_id').references(() => sumatPrompts.id, { onDelete: 'set null' }),
    /** The prompt as the sender saw it, kept even if the prompt is edited later. */
    promptText: text('prompt_text').notNull(),
    body: text('body').notNull(),
    sentAs: text('sent_as', { enum: SENT_AS }).notNull(),
    name: text('name'),
    courseYear: text('course_year'),
    status: text('status', { enum: MESSAGE_STATUSES }).notNull().default('new'),
    notes: text('notes'),
    receivedAt: timestamp('received_at'),
  },
  (t) => [
    oneOf('sumat_messages_sent_as', t.sentAs, SENT_AS),
    oneOf('sumat_messages_status', t.status, MESSAGE_STATUSES),
    index('sumat_messages_inbox').on(t.status, t.receivedAt),
  ],
);
