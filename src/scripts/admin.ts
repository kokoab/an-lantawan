/** Small behaviours shared by every admin page. */

// On phones the sidebar is a full-screen menu opened from the bar at the top.
const side = document.getElementById('admin-side');
const menuButton = document.querySelector<HTMLButtonElement>('[data-admin-menu]');
const menuClose = document.querySelector<HTMLButtonElement>('[data-admin-menu-close]');
const setMenu = (open: boolean) => {
  side?.classList.toggle('open', open);
  menuButton?.setAttribute('aria-expanded', String(open));
  if (open) menuClose?.focus();
  else menuButton?.focus();
};
menuButton?.addEventListener('click', () => setMenu(true));
menuClose?.addEventListener('click', () => setMenu(false));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && side?.classList.contains('open')) setMenu(false);
});

// Buttons that archive, delete or overwrite ask first. The question names what will happen.
document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest<HTMLElement>('[data-confirm]');
  if (button && !window.confirm(button.dataset.confirm ?? 'Are you sure?')) {
    event.preventDefault();
  }
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

// Filter menus apply as soon as a choice is made.
for (const el of document.querySelectorAll<HTMLElement>('[data-autosubmit]')) {
  if (el instanceof HTMLSelectElement) {
    el.addEventListener('change', () => el.form?.requestSubmit());
  }
}

// A slug field follows its title until someone edits the slug by hand.
for (const input of document.querySelectorAll<HTMLElement>('[data-slug-from]')) {
  if (!(input instanceof HTMLInputElement)) continue;
  const source = document.getElementById(input.dataset.slugFrom ?? '');
  if (!(source instanceof HTMLInputElement)) continue;
  let touched = input.value !== '';
  input.addEventListener('input', () => {
    touched = input.value !== '';
  });
  source.addEventListener('input', () => {
    if (touched) return;
    input.value = source.value
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
      .replace(/-+$/, '');
  });
}

// Forms marked data-unsaved warn before leaving with changes that weren't saved.
for (const form of document.querySelectorAll<HTMLFormElement>('form[data-unsaved]')) {
  let dirty = false;
  form.addEventListener('input', () => {
    dirty = true;
  });
  form.addEventListener('change', () => {
    dirty = true;
  });
  form.addEventListener('submit', () => {
    dirty = false;
  });
  window.addEventListener('beforeunload', (event) => {
    if (dirty) event.preventDefault();
  });
}
