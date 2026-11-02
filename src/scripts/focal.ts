/** Clicking a photo sets the point kept in view when it's cropped, in steps of 10%. */
const box = document.querySelector<HTMLElement>('[data-focal]');
const marker = document.querySelector<HTMLElement>('[data-focal-marker]');
const x = document.getElementById('focal-x');
const y = document.getElementById('focal-y');

const place = () => {
  if (!marker || !(x instanceof HTMLSelectElement) || !(y instanceof HTMLSelectElement)) return;
  marker.className = marker.className.replace(/\bf[xy]-\d+\b/g, '').trim();
  marker.classList.add(
    `fx-${Math.round(Number(x.value) * 100)}`,
    `fy-${Math.round(Number(y.value) * 100)}`,
  );
};

if (box && x instanceof HTMLSelectElement && y instanceof HTMLSelectElement) {
  box.addEventListener('click', (event) => {
    const r = box.getBoundingClientRect();
    const step = (v: number) => String(Math.min(10, Math.max(0, Math.round(v * 10))) / 10);
    x.value = step((event.clientX - r.left) / r.width);
    y.value = step((event.clientY - r.top) / r.height);
    place();
  });
  x.addEventListener('change', place);
  y.addEventListener('change', place);
}
