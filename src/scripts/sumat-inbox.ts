/** The Sumat inbox: selecting several letters, the publish dialog and keyboard shortcuts. */
const inbox = document.getElementById('inbox');
const bulk = document.querySelector<HTMLElement>('[data-bulk]');
const count = document.querySelector<HTMLElement>('[data-bulk-count]');
const boxes = () => [...document.querySelectorAll<HTMLInputElement>('#inbox input[name="ids"]')];

// Checkboxes appear once someone starts selecting (X, or a long look at the list).
const updateBulk = () => {
  const picked = boxes().filter((b) => b.checked).length;
  if (bulk) bulk.hidden = picked === 0;
  if (count) count.textContent = String(picked);
  inbox?.classList.toggle('selecting', picked > 0 || inbox.classList.contains('show-picks'));
};
inbox?.addEventListener('change', updateBulk);
document.querySelector('[data-bulk-clear]')?.addEventListener('click', () => {
  for (const b of boxes()) b.checked = false;
  inbox?.classList.remove('show-picks');
  updateBulk();
});

// Dialogs open and close from buttons that name them.
for (const button of document.querySelectorAll<HTMLElement>('[data-open-dialog]')) {
  button.addEventListener('click', () => {
    const dialog = document.getElementById(button.dataset.openDialog ?? '');
    if (dialog instanceof HTMLDialogElement) dialog.showModal();
  });
}
for (const button of document.querySelectorAll<HTMLElement>('[data-close-dialog]')) {
  button.addEventListener('click', () => button.closest('dialog')?.close());
}

// The open/closed switch saves as soon as it's flipped, with the prompt as typed.
for (const el of document.querySelectorAll<HTMLElement>('[data-autosubmit-check]')) {
  if (!(el instanceof HTMLInputElement)) continue;
  el.addEventListener('change', () => {
    const typed = document.getElementById('prompt');
    const copy = el.form?.querySelector<HTMLInputElement>('[data-prompt-copy]');
    if (typed instanceof HTMLInputElement && copy) copy.value = typed.value;
    el.form?.requestSubmit();
  });
}

// J and K move between letters; S shortlists, A archives, X selects the open letter.
document.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement;
  if (
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    target.closest('input, textarea, select, dialog[open]')
  )
    return;
  const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-letter]')];
  const current = links.findIndex((a) => a.closest('li')?.classList.contains('on'));
  const key = event.key.toLowerCase();
  if (key === 'j' || key === 'k') {
    const next = links[current + (key === 'j' ? 1 : -1)];
    if (next) next.click();
  } else if (key === 's' || key === 'a') {
    const button = document.querySelector<HTMLButtonElement>(
      `button[form="single"][value="${key === 's' ? 'shortlisted' : 'archived'}"]`,
    );
    button?.click();
  } else if (key === 'x' && current >= 0) {
    const box = links[current].closest('li')?.querySelector<HTMLInputElement>('input[name="ids"]');
    if (box) {
      inbox?.classList.add('show-picks');
      box.checked = !box.checked;
      updateBulk();
    }
  } else return;
  event.preventDefault();
});
updateBulk();

// Editor notes save when the field loses focus.
const notes = document.getElementById('notes');
if (notes instanceof HTMLTextAreaElement) {
  notes.addEventListener('change', () =>
    (document.getElementById('notes-form') as HTMLFormElement | null)?.requestSubmit(),
  );
}
