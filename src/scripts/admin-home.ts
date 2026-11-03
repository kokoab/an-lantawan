/** “Pick the top story”: narrows the list to headlines with every word typed. */
const search = document.querySelector<HTMLInputElement>('[data-story-search]');
const items = [...document.querySelectorAll<HTMLElement>('[data-story-list] li[data-title]')];
const empty = document.querySelector<HTMLElement>('[data-story-empty]');

search?.addEventListener('input', () => {
  const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
  let shown = 0;
  for (const item of items) {
    const match = words.every((w) => item.dataset.title?.includes(w));
    item.hidden = !match;
    if (match) shown++;
  }
  if (empty) empty.hidden = shown > 0;
});
