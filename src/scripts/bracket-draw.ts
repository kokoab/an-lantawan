/**
 * The draw on an event's admin page: tap a tribu, then the one it should trade places with,
 * or drag one onto the other. Either way the swap posts as a normal form, so the server
 * checks it like any other change.
 */
for (const form of document.querySelectorAll<HTMLFormElement>('[data-draw]')) {
  const from = form.elements.namedItem('from');
  const to = form.elements.namedItem('to');
  const status = form.parentElement?.querySelector<HTMLElement>('[data-draw-status]');
  if (!(from instanceof HTMLInputElement) || !(to instanceof HTMLInputElement)) continue;
  const intro = status?.textContent ?? '';
  let picked: HTMLButtonElement | null = null;

  const slotOf = (target: EventTarget | null) => {
    const el = target instanceof Element ? target.closest<HTMLButtonElement>('button.slot') : null;
    return el && !el.disabled ? el : null;
  };
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
    for (const slot of form.querySelectorAll<HTMLButtonElement>('button.slot'))
      slot.disabled = true;
    form.requestSubmit();
  };

  form.addEventListener('click', (event) => {
    const slot = slotOf(event.target);
    if (!slot) return;
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
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && picked) unpick();
  });

  let dragged: HTMLButtonElement | null = null;
  form.addEventListener('dragstart', (event) => {
    dragged = slotOf(event.target);
    if (!dragged) return event.preventDefault();
    event.dataTransfer?.setData('text/plain', dragged.dataset.slot ?? '');
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  });
  form.addEventListener('dragover', (event) => {
    const slot = slotOf(event.target);
    if (!dragged || !slot) return;
    event.preventDefault();
    for (const s of form.querySelectorAll('.slot.over')) s.classList.remove('over');
    if (slot !== dragged) slot.classList.add('over');
  });
  form.addEventListener('dragleave', (event) => {
    slotOf(event.target)?.classList.remove('over');
  });
  form.addEventListener('drop', (event) => {
    const slot = slotOf(event.target);
    if (!dragged || !slot) return;
    event.preventDefault();
    slot.classList.remove('over');
    swap(dragged, slot);
  });
  form.addEventListener('dragend', () => {
    dragged = null;
    for (const s of form.querySelectorAll('.slot.over')) s.classList.remove('over');
  });
}
