/** The Staff page: the chosen photo's name, initials as a name is typed, and reopening “Add a person” after an error. */
import { initials } from '../core/people';

for (const input of document.querySelectorAll<HTMLInputElement>('input[data-file]')) {
  const label = input.closest('label')?.querySelector<HTMLElement>('[data-file-label]');
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (label && file) label.textContent = file.name;
  });
}

const add = document.getElementById('add-person');
if (add instanceof HTMLDialogElement) {
  const preview = add.querySelector<HTMLElement>('[data-photo-preview]');
  const name = add.querySelector<HTMLInputElement>('input[name="name"]');
  const update = () => {
    if (preview && name) preview.textContent = name.value.trim() ? initials(name.value) : '?';
  };
  name?.addEventListener('input', update);
  update();
  if (add.dataset.open !== undefined) add.showModal();
}
