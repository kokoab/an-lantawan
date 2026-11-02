import { and, eq, lte, or, sql } from 'drizzle-orm';
import { stories } from '../schema';

/**
 * Stories readers can see: published ones, and scheduled ones whose time has come. The
 * same rule as `isLive` in src/core/stories.ts, written for the database.
 */
export const liveStory = or(
  eq(stories.status, 'published'),
  and(eq(stories.status, 'scheduled'), lte(stories.publishedAt, sql`(unixepoch())`)),
);
