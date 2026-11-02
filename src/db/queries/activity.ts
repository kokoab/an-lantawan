import type { Db } from '../client';
import { activityLog } from '../schema';

export interface Activity {
  editorId: number | null;
  action: string;
  entityType: string;
  entityId?: number | null;
  summary: string;
}

export async function logActivity(db: Db, a: Activity) {
  await db.insert(activityLog).values({ ...a, entityId: a.entityId ?? null });
}
