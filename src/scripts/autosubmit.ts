/** Filter menus marked `data-autosubmit` apply as soon as a choice is made. */
for (const el of document.querySelectorAll<HTMLElement>('[data-autosubmit]')) {
  if (!(el instanceof HTMLSelectElement)) continue;
  el.addEventListener('change', () => el.form?.requestSubmit());
}
