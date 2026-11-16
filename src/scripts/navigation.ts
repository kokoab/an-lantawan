/**
 * Makes moving between pages feel quicker, on every page:
 * - A thin bar starts across the top the moment a link is clicked or a form is sent, so
 *   nobody is left wondering whether the tap registered.
 * - Pages are fetched ahead when a link is hovered, focused or touched, so by the time the
 *   click lands the page is often already here. Only plain pages on this site are fetched
 *   ahead: never sign-in, API, file or download links.
 */

const bar = document.createElement('div');
bar.className = 'nav-progress';
bar.setAttribute('aria-hidden', 'true');
document.body.appendChild(bar);

const start = () => {
  bar.classList.remove('done');
  // Restart the animation even if it ran before (after Back, say).
  bar.classList.remove('loading');
  void bar.offsetWidth;
  bar.classList.add('loading');
};
const finish = () => {
  if (!bar.classList.contains('loading')) return;
  bar.classList.add('done');
  bar.classList.remove('loading');
};

/** A same-site page link a normal click would follow in this tab. */
function pageLink(target: EventTarget | null): HTMLAnchorElement | null {
  const a = target instanceof Element ? target.closest('a') : null;
  if (!a?.href || a.target === '_blank' || a.hasAttribute('download')) return null;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return null;
  if (/^\/(auth|api|media)\//.test(url.pathname)) return null;
  // Jumping within the same page loads nothing.
  if (url.pathname === location.pathname && url.search === location.search && url.hash) {
    return null;
  }
  return a;
}

document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (pageLink(event.target)) start();
});

// Forms: start once the submit really goes ahead (a confirm can still cancel it).
document.addEventListener('submit', (event) => {
  queueMicrotask(() => {
    if (!event.defaultPrevented && !(event.target as HTMLFormElement).target) start();
  });
});

// Coming back from the browser's page cache, or a download that didn't leave the page.
window.addEventListener('pageshow', finish);
window.addEventListener('focus', () => setTimeout(finish, 1500));

const fetched = new Set<string>();
const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;

function prefetch(target: EventTarget | null) {
  if (connection?.saveData) return;
  const a = pageLink(target);
  if (!a) return;
  const url = new URL(a.href);
  url.hash = '';
  if (url.href === location.href.split('#')[0] || fetched.has(url.href)) return;
  fetched.add(url.href);
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url.href;
  document.head.appendChild(link);
}

let hoverTimer: ReturnType<typeof setTimeout> | undefined;
document.addEventListener('pointerover', (event) => {
  if (event.pointerType !== 'mouse') return;
  clearTimeout(hoverTimer);
  // A short pause, so sweeping the mouse across a menu doesn't fetch every page.
  hoverTimer = setTimeout(() => prefetch(event.target), 80);
});
document.addEventListener('pointerout', () => clearTimeout(hoverTimer));
document.addEventListener('touchstart', (event) => prefetch(event.target), { passive: true });
document.addEventListener('focusin', (event) => prefetch(event.target));

export {};
