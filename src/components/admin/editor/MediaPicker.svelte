<script lang="ts">
/** Choose a photo from the library, or upload one, in a dialog. */
interface Item {
  id: number;
  key: string;
  alt: string;
  caption: string;
  width: number | null;
  height: number | null;
}

let { onpick }: { onpick: (item: Item) => void } = $props();

let dialog: HTMLDialogElement;
let items = $state<Item[]>([]);
let q = $state('');
let page = $state(1);
let pages = $state(1);
let loading = $state(false);
let error = $state('');
let uploading = $state(false);
let alt = $state('');

async function load() {
  loading = true;
  error = '';
  try {
    const res = await fetch(`/api/admin/media?kind=image&page=${page}&q=${encodeURIComponent(q)}`);
    if (res.status === 401) throw new Error('signed out');
    const data = await res.json();
    items = data.items;
    pages = data.pages;
  } catch {
    error = 'The library didn’t load. Check that you’re still signed in, then try again.';
  } finally {
    loading = false;
  }
}

export function open() {
  dialog.showModal();
  load();
}

function pick(item: Item) {
  dialog.close();
  onpick(item);
}

async function upload(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  uploading = true;
  error = '';
  const body = new FormData();
  body.append('file', file);
  body.append('alt', alt);
  try {
    const res = await fetch('/api/admin/media', { method: 'POST', body });
    const data = await res.json().catch(() => ({ ok: false }));
    if (!data.ok) throw new Error(data.error ?? 'The upload didn’t go through. Try again.');
    alt = '';
    pick(data.item);
  } catch (e) {
    error = e instanceof Error ? e.message : 'The upload didn’t go through. Try again.';
  } finally {
    uploading = false;
    input.value = '';
  }
}
</script>

<dialog bind:this={dialog} class="picker" aria-labelledby="picker-title">
  <div class="picker-head">
    <h2 id="picker-title">Choose a photo</h2>
    <button type="button" class="btn btn-secondary btn-small" onclick={() => dialog.close()}>Close</button>
  </div>

  <div class="picker-upload">
    <div class="field">
      <label for="picker-alt">Describe the new photo</label>
      <input id="picker-alt" type="text" maxlength="300" bind:value={alt} />
    </div>
    <div class="field">
      <label for="picker-file">Upload a new photo</label>
      <input id="picker-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onchange={upload} disabled={uploading} />
    </div>
  </div>
  {#if uploading}<p class="muted small" role="status">Uploading…</p>{/if}

  <form class="picker-search" role="search" onsubmit={(e) => { e.preventDefault(); page = 1; load(); }}>
    <label class="visually-hidden" for="picker-q">Search the library</label>
    <input id="picker-q" type="search" placeholder="Search the library" bind:value={q} />
    <button class="btn btn-secondary" type="submit">Search</button>
  </form>

  {#if error}<p class="field-error" role="alert">{error}</p>{/if}

  {#if loading}
    <ul class="picker-grid" aria-busy="true">
      {#each Array(12) as _}<li class="skeleton"></li>{/each}
    </ul>
  {:else if items.length === 0}
    <p class="muted">No photos match. Upload one above.</p>
  {:else}
    <ul class="picker-grid">
      {#each items as item (item.id)}
        <li>
          <button type="button" onclick={() => pick(item)} title={item.alt || item.key}>
            <img src={`/media/${item.key}`} alt={item.alt} loading="lazy" />
            <span>{item.alt || 'No description'}</span>
          </button>
        </li>
      {/each}
    </ul>
    {#if pages > 1}
      <div class="pager">
        <button type="button" class="btn btn-secondary btn-small" disabled={page <= 1} onclick={() => { page -= 1; load(); }}>Previous</button>
        <span class="muted small">Page {page} of {pages}</span>
        <button type="button" class="btn btn-secondary btn-small" disabled={page >= pages} onclick={() => { page += 1; load(); }}>Next</button>
      </div>
    {/if}
  {/if}
</dialog>

<style>
  .picker {
    width: min(960px, calc(100vw - 32px));
    max-height: calc(100vh - 48px);
    padding: 20px;
    border: 1px solid var(--ink);
    background: var(--white);
  }
  .picker::backdrop {
    background: rgb(10 10 10 / 0.5);
  }
  .picker-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .picker-head h2 {
    margin: 0;
    font-size: 20px;
  }
  .picker-upload {
    display: grid;
    gap: 12px;
    margin-bottom: 16px;
    padding: 12px;
    border: 1px dashed var(--grey-300);
  }
  .picker-search {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }
  .picker-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .picker-grid button {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    padding: 6px;
    border: 1px solid var(--grey-300);
    background: var(--white);
    text-align: left;
    cursor: pointer;
  }
  .picker-grid button:hover,
  .picker-grid button:focus-visible {
    border-color: var(--ink);
  }
  .picker-grid img {
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
    background: var(--grey-100);
  }
  .picker-grid span {
    overflow: hidden;
    font-size: 12px;
    line-height: 16px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .skeleton {
    aspect-ratio: 1;
    background: var(--grey-100);
  }
  @media (min-width: 768px) {
    .picker-upload {
      grid-template-columns: 1fr 1fr;
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    .skeleton {
      animation: pulse 1.2s ease-in-out infinite;
    }
    @keyframes pulse {
      50% {
        opacity: 0.5;
      }
    }
  }
</style>
