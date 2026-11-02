import { asc, eq } from 'drizzle-orm';
import type { Db } from '../../client';
import { people, staffTerms } from '../../schema';

/** The editorial board of one school year, in board order. */
export async function listBoard(db: Db, schoolYear: string) {
  return db
    .select({
      id: staffTerms.id,
      personId: people.id,
      name: people.name,
      position: staffTerms.position,
      sort: staffTerms.sort,
    })
    .from(staffTerms)
    .innerJoin(people, eq(people.id, staffTerms.personId))
    .where(eq(staffTerms.schoolYear, schoolYear))
    .orderBy(asc(staffTerms.sort), asc(people.name));
}
