import { asc, eq } from 'drizzle-orm';
import type { MenuGroup, MenuRow } from '../../../core/menus';
import { runBatch } from '../../batch';
import type { Db } from '../../client';
import { menuItems } from '../../schema';

export async function listMenuItems(db: Db) {
  return db.select().from(menuItems).orderBy(asc(menuItems.group), asc(menuItems.sort));
}

/** Replaces a menu's links with the given ones, in order, in one batch. */
export async function saveMenu(db: Db, group: MenuGroup, rows: MenuRow[]) {
  await runBatch(db, [
    db.delete(menuItems).where(eq(menuItems.group, group)),
    ...rows.map((r, i) => db.insert(menuItems).values({ ...r, group, sort: i + 1 })),
  ]);
}
