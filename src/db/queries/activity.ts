import type { Db } from '../client';
import { activityLog } from '../schema';

export interface Activity {
  editorId: number | null;
  /** The staff member who was editing. */
  personId?: number | null;
  /** Stories, Home, Sumat, Sportsfest, Print issues, Staff or Site settings. */
  area?: string | null;
  /** How to undo this change, if it can be undone. */
  undo?: unknown;
  action: string;
  entityType: string;
  entityId?: number | null;
  summary: string;
}

export async function logActivity(db: Db, a: Activity) {
  await db.insert(activityLog).values({
    ...a,
    entityId: a.entityId ?? null,
    personId: a.personId ?? null,
    area: a.area ?? null,
    undo: a.undo ?? null,
  });
}
