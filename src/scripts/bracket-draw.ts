/**
 * The draw on an event's admin page. Tribus in a bracket's first round are buttons: tap
 * one, then the one it should trade places with, or drag one onto the other. The swap
 * posts through the draw's own small form, so the server checks it like any other change.
 */
for (const form of document.querySelectorAll<HTMLFormElement>('form[data-draw]')) {
  const from = form.elements.namedItem('from');
  const to = form.elements.namedItem('to');
  if (!(from instanceof HTMLInputElement) || !(to instanceof HTMLInputElement)) continue;
  const slots = [...document.querySelectorAll<HTMLButtonElement>(`[data-draw-slot="${form.id}"]`)];
  const status = document.querySelector<HTMLElement>(`[data-draw-status="${form.id}"]`);
  const intro = status?.textContent ?? '';
  let picked: HTMLButtonElement | null = null;

  const say = (text: string) => {
    if (status) status.textContent = text;
  };
  const unpick = () => {
    picked?.setAttribute('aria-pressed', 'false');
    picked = null;
    say(intro);
  };
  const swap = (a: HTMLButtonElement, b: HTMLButtonElement) => {
    if (a === b) return unpick();
    from.value = a.dataset.slot ?? '';
    to.value = b.dataset.slot ?? '';
    say(`Swapping ${a.dataset.name} and ${b.dataset.name}…`);
    for (const slot of slots) slot.disabled = true;
    form.requestSubmit();
  };

  let dragged: HTMLButtonElement | null = null;
  const clearOver = () => {
    for (const s of slots) s.classList.remove('over');
  };
  for (const slot of slots) {
    slot.addEventListener('click', () => {
      if (!picked) {
        picked = slot;
        slot.setAttribute('aria-pressed', 'true');
        say(
          `${slot.dataset.name} picked. Tap the tribu it should trade places with, or tap it again to cancel.`,
        );
      } else {
        swap(picked, slot);
      }
    });
    slot.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && picked) unpick();
    });
    slot.addEventListener('dragstart', (event) => {
      dragged = slot;
      event.dataTransfer?.setData('text/plain', slot.dataset.slot ?? '');
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });
    slot.addEventListener('dragover', (event) => {
      if (!dragged) return;
      event.preventDefault();
      clearOver();
      if (slot !== dragged) slot.classList.add('over');
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('over'));
    slot.addEventListener('drop', (event) => {
      if (!dragged) return;
      event.preventDefault();
      clearOver();
      swap(dragged, slot);
    });
    slot.addEventListener('dragend', () => {
      dragged = null;
      clearOver();
    });
  }
}
