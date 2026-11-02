import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { checkSubmission, MAX_PER_MINUTE, type SubmissionError } from '../../core/sumat/submission';
import { db } from '../../db/client';
import { getSettings } from '../../db/queries/settings';
import { currentPrompt, recentMessageCount, saveMessage } from '../../db/queries/sumat';
import { verifyTurnstile } from '../../lib/turnstile';

const STATUS: Record<SubmissionError | 'server', number> = {
  closed: 403,
  empty: 400,
  name_required: 400,
  too_fast: 400,
  busy: 429,
  verification: 403,
  server: 500,
};

const reply = (
  body: { ok: true; id?: number } | { ok: false; error: SubmissionError | 'server' },
) => Response.json(body, { status: body.ok ? 200 : STATUS[body.error] });

export const POST: APIRoute = async ({ request }) => {
  try {
    const prompt = await currentPrompt(db);
    if (!prompt) return reply({ ok: false, error: 'closed' });

    const input = await request.json().catch(() => ({}));
    const { 'sumat.max_length': maxLength } = await getSettings(db, { 'sumat.max_length': 500 });
    const checked = checkSubmission(input, maxLength);
    if (checked.kind === 'discard') return reply({ ok: true });
    if (checked.kind === 'reject') return reply({ ok: false, error: checked.error });

    if ((await recentMessageCount(db)) >= MAX_PER_MINUTE)
      return reply({ ok: false, error: 'busy' });

    if (env.TURNSTILE_SECRET) {
      const ip = request.headers.get('cf-connecting-ip');
      const human = await verifyTurnstile(env.TURNSTILE_SECRET, checked.turnstileToken, ip);
      if (!human) return reply({ ok: false, error: 'verification' });
    }

    const id = await saveMessage(db, prompt, checked.value);
    return reply({ ok: true, id });
  } catch (err) {
    console.error('Sumat intake failed', err);
    return reply({ ok: false, error: 'server' });
  }
};
