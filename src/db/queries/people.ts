import { and, desc, eq, isNull } from 'drizzle-orm';
import { boardOrder } from '../../core/people';
import type { Db } from '../client';
import { media, people, staffTerms } from '../schema';

/** The newest school year's editorial board, in board order. */
export async function getEditorialBoard(db: Db) {
  const [latest] = await db
    .select({ year: staffTerms.schoolYear })
    .from(staffTerms)
    .orderBy(desc(staffTerms.schoolYear))
    .limit(1);
  if (!latest) return { year: null, members: [] };
  const members = await db
    .select({
      name: people.name,
      slug: people.slug,
      position: staffTerms.position,
      sort: staffTerms.sort,
      hasProfile: people.hasProfile,
      photoKey: media.key,
    })
    .from(staffTerms)
    .innerJoin(people, eq(people.id, staffTerms.personId))
    .leftJoin(media, eq(media.id, people.photoId))
    .where(
      and(
        eq(staffTerms.schoolYear, latest.year),
        eq(staffTerms.onBoard, true),
        isNull(people.archivedAt),
      ),
    );
  return { year: latest.year, members: boardOrder(members) };
}

/** A person's profile: who they are and every position they've held. Null if they have none. */
export async function getPerson(db: Db, slug: string) {
  const [person] = await db
    .select({
      id: people.id,
      name: people.name,
      slug: people.slug,
      bio: people.bio,
      photoKey: media.key,
    })
    .from(people)
    .leftJoin(media, eq(media.id, people.photoId))
    .where(and(eq(people.slug, slug), eq(people.hasProfile, true)))
    .limit(1);
  if (!person) return null;
  const terms = await db
    .select({ schoolYear: staffTerms.schoolYear, position: staffTerms.position })
    .from(staffTerms)
    .where(eq(staffTerms.personId, person.id))
    .orderBy(desc(staffTerms.schoolYear));
  return { ...person, terms };
}
