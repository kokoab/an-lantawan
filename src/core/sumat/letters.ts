/** Turning a Sumat message into a published letter. */

/**
 * The signature under a published letter. Anonymous letters always say "Anonymous", so
 * nothing about the sender can slip into print; signed ones use the name and course given.
 */
export function defaultSignature(
  sentAs: 'anonymous' | 'named',
  name: string | null,
  courseYear: string | null,
) {
  if (sentAs === 'anonymous') return 'Anonymous';
  return [name?.trim(), courseYear?.trim()].filter(Boolean).join(', ') || 'Anonymous';
}

/** Where a letter lives: /<section>/letter-<message id>, unique per message. */
export const letterSlug = (messageId: number) => `letter-${messageId}`;
