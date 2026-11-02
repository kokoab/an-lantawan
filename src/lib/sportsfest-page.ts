import { db } from '../db/client';
import { getSportsfest } from '../db/queries/sportsfest';

/** The Sportsfest a `[year]` route names, or null for anything that is not a known year. */
export async function sportsfestFromParam(param: string | undefined) {
  if (!param || !/^\d{4}$/.test(param)) return null;
  return getSportsfest(db, Number(param));
}
