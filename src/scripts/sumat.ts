import type { SubmissionError } from '../core/sumat/submission';

const DRAFT_KEY = 'sumat-draft';
const SEND_LABEL = 'Send it →';

const ERRORS: Record<SubmissionError, string> = {
  closed: "Sumat isn't taking messages right now.",
  empty: 'Write a message before sending.',
  name_required: 'Add your name, or switch to Anonymous.',
  too_fast: 'That was quick. Wait a few seconds, then send again.',
  busy: 'Lots of messages right now. Try again in a minute.',
  verification: "We couldn't verify the request. Reload the page and try again.",
};
const TURNSTILE_LOAD_ERROR =
  "The spam check didn't load. Turn off content blockers for this page, then reload.";
const TURNSTILE_FAILED = "We couldn't confirm this browser. Reload the page and try again.";
const FALLBACK_ERROR = "Your message didn't send. Check your connection and try again.";

interface TurnstileApi {
  render(el: string, options: Record<string, unknown>): void;
  reset(): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
    onTurnstileLoad?: () => void;
  }
}

const draft = {
  get: () => {
    try {
      return localStorage.getItem(DRAFT_KEY) ?? '';
    } catch {
      return '';
    }
  },
  set: (v: string) => {
    try {
      if (v) localStorage.setItem(DRAFT_KEY, v);
      else localStorage.removeItem(DRAFT_KEY);
    } catch {}
  },
};

function byId<T extends HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

export function initSumat() {
  const compose = document.getElementById('compose') as HTMLFormElement | null;
  if (!compose) return; // Sumat is closed.
  const form = compose;

  const message = byId<HTMLTextAreaElement>('message');
  const count = byId('count');
  const send = byId<HTMLButtonElement>('send');
  const named = byId('named');
  const nameInput = byId<HTMLInputElement>('name');
  const courseInput = byId<HTMLInputElement>('course');
  const error = byId('error');
  const sent = byId('sent');
  const radios = [...form.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
  const maxLength = Number(form.dataset.maxLength) || 500;
  const turnstileSiteKey = form.dataset.turnstileSiteKey ?? '';
  const openedAt = Date.now();
  let identity: 'anonymous' | 'named' = 'anonymous';
  let turnstileToken = '';

  function update() {
    count.textContent = `${message.value.length} / ${maxLength}`;
    const ready =
      message.value.trim().length >= 2 &&
      (identity === 'anonymous' || nameInput.value.trim() !== '') &&
      (!turnstileSiteKey || turnstileToken !== '');
    send.disabled = !ready;
  }

  function setIdentity(value: typeof identity) {
    identity = value;
    for (const r of radios) r.setAttribute('aria-checked', String(r.dataset.identity === value));
    named.hidden = value !== 'named';
    if (value === 'named') nameInput.focus();
    update();
  }

  radios.forEach((r, i) => {
    r.addEventListener('click', () => setIdentity(r.dataset.identity as typeof identity));
    r.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const step = e.key === 'ArrowRight' ? 1 : -1;
      const next = radios[(i + step + radios.length) % radios.length];
      next.focus();
      setIdentity(next.dataset.identity as typeof identity);
    });
  });

  message.addEventListener('input', () => {
    draft.set(message.value);
    error.textContent = '';
    update();
  });
  message.addEventListener('compositionend', update);
  nameInput.addEventListener('input', update);
  nameInput.addEventListener('compositionend', update);

  // On phones, tapping a button while typing first closes the keyboard, which shifts
  // the page so the tap misses. Keeping focus in the field makes the first tap count.
  for (const b of [send, ...radios]) b.addEventListener('mousedown', (e) => e.preventDefault());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    update();
    if (send.disabled) return;
    (document.activeElement as HTMLElement | null)?.blur(); // close the keyboard while sending
    send.disabled = true;
    send.textContent = 'Sending…';
    error.textContent = '';
    try {
      const res = await fetch('/api/sumat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.value,
          identity,
          name: identity === 'named' ? nameInput.value : '',
          course: identity === 'named' ? courseInput.value : '',
          website: byId<HTMLInputElement>('website').value,
          elapsedMs: Date.now() - openedAt,
          turnstileToken,
        }),
      });
      const result = (await res.json()) as { ok: boolean; error?: SubmissionError };
      if (!result.ok) throw new Error(result.error ?? 'server');
      showSent();
    } catch (err) {
      const code = (err as Error).message as SubmissionError;
      error.textContent = ERRORS[code] ?? FALLBACK_ERROR;
      send.textContent = SEND_LABEL;
      update();
      resetTurnstile();
    }
  });

  function showSent() {
    byId('sent-as').textContent = identity === 'named' ? 'Sent with your name' : 'Sent anonymously';
    draft.set('');
    form.hidden = true;
    sent.hidden = false;
    byId('sent-title').focus();
  }

  byId('again').addEventListener('click', () => {
    message.value = '';
    nameInput.value = '';
    courseInput.value = '';
    send.textContent = SEND_LABEL;
    resetTurnstile();
    setIdentity('anonymous');
    sent.hidden = true;
    form.hidden = false;
    message.focus();
  });

  // A token works once, so every attempt needs a fresh one.
  function resetTurnstile() {
    if (!turnstileSiteKey) return;
    turnstileToken = '';
    window.turnstile?.reset();
    update();
  }

  if (turnstileSiteKey) {
    const setToken = (t: string) => {
      turnstileToken = t;
      update();
    };
    // The widget is set to invisible mode in Cloudflare: it checks the browser in the
    // background while the person types, and never shows anything on the page.
    window.onTurnstileLoad = () =>
      window.turnstile?.render('#turnstile', {
        sitekey: turnstileSiteKey,
        callback: (t: string) => {
          error.textContent = '';
          setToken(t);
        },
        'expired-callback': () => resetTurnstile(),
        'error-callback': () => {
          setToken('');
          error.textContent = TURNSTILE_FAILED;
        },
      });
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';
    s.async = true;
    s.addEventListener('error', () => {
      error.textContent = TURNSTILE_LOAD_ERROR;
    });
    document.head.appendChild(s);
  }

  message.value = draft.get();
  update();
}
