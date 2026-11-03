/** The Continue button names the person picked: “Continue as Mark Villanueva”. */
const button = document.querySelector<HTMLButtonElement>('.who button[type="submit"]');
const update = () => {
  const picked = document.querySelector<HTMLInputElement>('.who input[name="personId"]:checked');
  const name = picked?.closest('label')?.querySelector('strong')?.textContent;
  if (button) button.textContent = name ? `Continue as ${name}` : 'Continue';
};
document.querySelector('.who')?.addEventListener('change', update);
update();
