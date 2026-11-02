import { and, count, desc, gt, isNull, lte, or } from 'drizzle-orm';
import type { CleanSubmission } from '../../core/sumat/submission';
import type { Db } from '../client';
import { sumatMessages, sumatPrompts } from '../schema';

/** The newest prompt that has opened and not closed. None means Sumat is closed. */
export async function currentPrompt(db: Db, now = new Date()) {
  const [prompt] = await db
    .select()
    .from(sumatPrompts)
    .where(
      and(
        lte(sumatPrompts.opensAt, now),
        or(isNull(sumatPrompts.closesAt), gt(sumatPrompts.closesAt, now)),
      ),
    )
    .orderBy(desc(sumatPrompts.opensAt))
    .limit(1);
  return prompt ?? null;
}

/** Messages received in the last minute, across everyone. Used as a simple flood guard. */
export async function recentMessageCount(db: Db, now = new Date()) {
  const since = new Date(now.getTime() - 60_000);
  const [row] = await db
    .select({ n: count() })
    .from(sumatMessages)
    .where(gt(sumatMessages.receivedAt, since));
  return row?.n ?? 0;
}

export async function saveMessage(
  db: Db,
  prompt: { id: number; text: string },
  message: CleanSubmission,
) {
  const [row] = await db
    .insert(sumatMessages)
    .values({ promptId: prompt.id, promptText: prompt.text, ...message })
    .returning({ id: sumatMessages.id });
  return row.id;
}
