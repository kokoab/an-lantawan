import { eq, inArray, sql } from 'drizzle-orm';
import type { Finish } from '../core/sportsfest/medals';
import type { Db } from '../db/client';
import { saveFinishes } from '../db/queries/admin/sportsfest';
import { getVersion, restoreVersion, setStoryState } from '../db/queries/admin/stories';
import { saveSettings } from '../db/queries/settings';
import { issues, people, sections, sumatMessages, tribus } from '../db/schema';

/**
 * How to undo a change, stored with it in the activity log. Restore on the Activity page
 * applies it once. Each kind puts back exactly what the change replaced.
 */
export type Undo =
  | { kind: 'settings'; before: Record<string, unknown> }
  | { kind: 'story-version'; storyId: number; versionId: number }
  | {
      kind: 'story-state';
      storyId: number;
      status: 'draft' | 'scheduled' | 'published' | 'archived';
      publishedAt: string | null;
    }
  | { kind: 'results'; categoryId: number; finishes: Array<Finish & { mark?: string | null }> }
  | { kind: 'messages'; ids: number[]; status: 'new' | 'shortlisted' | 'published' | 'archived' }
  | {
      kind: 'archive';
      table: 'sections' | 'people' | 'tribus' | 'issues';
      id: number;
      archived: boolean;
    };

/** How long a change can be undone. */
export const UNDO_DAYS = 30;

const ARCHIVABLE = { sections, people, tribus, issues };

export async function applyUndo(db: Db, undo: Undo, editorId: number) {
  switch (undo.kind) {
    case 'settings':
      await saveSettings(db, undo.before, editorId);
      return;
    case 'story-version': {
      const v = await getVersion(db, undo.storyId, undo.versionId);
      if (!v) throw new Error('That version is gone.');
      await restoreVersion(db, undo.storyId, v, editorId);
      return;
    }
    case 'story-state':
      await setStoryState(
        db,
        undo.storyId,
        undo.status,
        undo.publishedAt ? new Date(undo.publishedAt) : null,
      );
      return;
    case 'results':
      await saveFinishes(db, undo.categoryId, undo.finishes);
      return;
    case 'messages':
      if (undo.ids.length) {
        await db
          .update(sumatMessages)
          .set({ status: undo.status })
          .where(inArray(sumatMessages.id, undo.ids));
      }
      return;
    case 'archive': {
      const table = ARCHIVABLE[undo.table];
      await db
        .update(table)
        .set({ archivedAt: undo.archived ? sql`(unixepoch())` : null })
        .where(eq(table.id, undo.id));
      return;
    }
  }
}
