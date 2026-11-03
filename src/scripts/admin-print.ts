/**
 * Print issues: a PDF uploads as soon as it's picked, with progress, while the rest of the
 * form is filled in. The form waits for it, then sends only the uploaded file's ID.
 */
const MB = 1024 * 1024;
const MAX = 50 * MB;
const size = (bytes: number) =>
  bytes < MB ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${Math.round(bytes / MB)} MB`;
const timeLeft = (seconds: number) => {
  if (seconds < 5) return 'Almost done.';
  if (seconds < 90) return `About ${Math.round(seconds / 5) * 5} seconds left.`;
  return `About ${Math.round(seconds / 60)} minutes left.`;
};

for (const root of document.querySelectorAll<HTMLElement>('[data-pdf-upload]')) {
  const q = <T extends Element>(s: string) => root.querySelector<T>(s);
  const file = q<HTMLInputElement>('[data-pdf-file]');
  const id = q<HTMLInputElement>('[data-pdf-id]');
  const drop = q<HTMLElement>('[data-pdf-drop]');
  const box = q<HTMLElement>('[data-pdf-box]');
  const name = q<HTMLElement>('[data-pdf-name]');
  const replace = q<HTMLElement>('[data-pdf-replace]');
  const cancel = q<HTMLButtonElement>('[data-pdf-cancel]');
  const progress = q<HTMLProgressElement>('[data-pdf-progress]');
  const status = q<HTMLElement>('[data-pdf-status]');
  const error = q<HTMLElement>('[data-pdf-error]');
  const form = root.closest('form');
  if (
    !file ||
    !id ||
    !drop ||
    !box ||
    !name ||
    !replace ||
    !cancel ||
    !progress ||
    !status ||
    !error ||
    !form
  )
    continue;

  const submits = [...form.querySelectorAll<HTMLButtonElement>('button[type="submit"]')];
  const waiting = form.querySelector<HTMLElement>('[data-pdf-waiting]');
  // What to go back to on cancel: the last file uploaded or already on the issue, or nothing.
  let before = {
    hasFile: !box.hidden,
    name: name.textContent ?? '',
    status: status.textContent ?? '',
  };
  let xhr: XMLHttpRequest | null = null;

  const busy = (on: boolean) => {
    for (const b of submits) b.disabled = on;
    if (waiting) waiting.hidden = !on;
    progress.hidden = !on;
    cancel.hidden = !on;
    replace.hidden = on;
  };
  const showError = (text: string) => {
    error.textContent = text;
    error.hidden = false;
  };
  const restore = () => {
    busy(false);
    file.value = '';
    box.hidden = !before.hasFile;
    drop.hidden = before.hasFile;
    name.textContent = before.name;
    status.textContent = before.status;
  };

  file.addEventListener('change', () => {
    const picked = file.files?.[0];
    if (!picked) return;
    error.hidden = true;
    if (picked.size > MAX) {
      file.value = '';
      showError('That PDF is bigger than 50 MB. Save a smaller copy and try again.');
      return;
    }
    drop.hidden = true;
    box.hidden = false;
    name.textContent = picked.name;
    status.textContent = `0 of ${size(picked.size)}. You can keep filling in the form.`;
    progress.value = 0;
    busy(true);

    const data = new FormData();
    data.append('file', picked);
    data.append('kind', 'pdf');
    const started = Date.now();
    xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/media');
    xhr.responseType = 'json';
    xhr.upload.addEventListener('progress', (e) => {
      if (!e.lengthComputable) return;
      progress.value = (e.loaded / e.total) * 100;
      const rate = e.loaded / Math.max(1, (Date.now() - started) / 1000);
      status.textContent = `${size(e.loaded)} of ${size(e.total)}. ${timeLeft((e.total - e.loaded) / rate)} You can keep filling in the form.`;
    });
    xhr.addEventListener('load', () => {
      const res = xhr?.response as {
        ok?: boolean;
        error?: string;
        item?: { id: number; bytes: number; pages: number | null };
      } | null;
      if (xhr?.status === 200 && res?.ok && res.item) {
        id.value = String(res.item.id);
        // The file is uploaded; don't send it again with the form.
        file.value = '';
        busy(false);
        status.textContent = `${size(res.item.bytes)}. Uploaded.`;
        before = { hasFile: true, name: picked.name, status: status.textContent };
        const pages = form.querySelector<HTMLInputElement>('input[name="pages"]');
        if (pages && pages.value === '' && res.item.pages) pages.value = String(res.item.pages);
      } else {
        restore();
        showError(res?.error ?? 'The upload didn’t finish. Check the connection and try again.');
      }
    });
    xhr.addEventListener('error', () => {
      restore();
      showError('The upload didn’t finish. Check the connection and try again.');
    });
    xhr.addEventListener('abort', restore);
    xhr.send(data);
  });

  cancel.addEventListener('click', () => xhr?.abort());
}

// Cover pickers show the chosen file's name.
for (const input of document.querySelectorAll<HTMLInputElement>('input[data-file]')) {
  const label = input.closest('label')?.querySelector<HTMLElement>('[data-file-label]');
  input.addEventListener('change', () => {
    const picked = input.files?.[0];
    if (label && picked) label.textContent = picked.name;
  });
}

// “Add an issue” opens again when what was sent needs fixing.
const add = document.getElementById('add-issue');
if (add instanceof HTMLDialogElement && add.dataset.open !== undefined) add.showModal();
