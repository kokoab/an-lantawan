<script lang="ts">
/**
 * The story editor, as in the Admin · Story editor frames. Drafts save on their own while
 * you type; a live story saves when you press Update. Publishing runs “Before you
 * publish” first. Everything is checked again on the server.
 */

import { onDestroy, onMount } from 'svelte';
import EyeIcon from '../../../assets/icons/admin/eye.svg?raw';
import PinIcon from '../../../assets/icons/admin/pin.svg?raw';
import SendIcon from '../../../assets/icons/admin/send.svg?raw';
import TrashIcon from '../../../assets/icons/admin/trash.svg?raw';
import UploadIcon from '../../../assets/icons/admin/upload.svg?raw';
import type { EditorChoices, EditorStory } from '../../../lib/story-editor-props';
import BlockList, { type Item } from './BlockList.svelte';
import CoverDialog, { type Cover } from './CoverDialog.svelte';
import MediaPicker from './MediaPicker.svelte';
import PublishDialog from './PublishDialog.svelte';
import ScheduleDialog from './ScheduleDialog.svelte';

type Story = EditorStory;

let {
  story,
  sections,
  people,
  events,
  host,
  me,
}: {
  story: Story;
  sections: EditorChoices['sections'];
  people: EditorChoices['people'];
  events: EditorChoices['events'];
  host: string;
  me: string | null;
} = $props();

const KINDS = [
  ['article', 'Story'],
  ['explainer', 'Explainer'],
  ['opinion', 'Column'],
  ['editorial', 'Editorial'],
  ['cartoon', 'Editorial cartoon'],
  ['photo', 'Photo story'],
  ['video', 'Video'],
  ['letter', 'Letter'],
];

// The story being edited. Everything below reads and writes this.
let s = $state<Story>(JSON.parse(JSON.stringify(story)));
let items = $state<Item[]>(
  (story.body.content.length ? story.body.content : [{ type: 'paragraph' }]).map((node, i) => ({
    key: i + 1,
    node: node as Record<string, any>,
  })),
);
const slugOf = (t: string) =>
  t
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
// A draft's link follows its headline until someone types a link of their own.
let slugAuto = $state(
  !story.id ||
    (story.status === 'draft' &&
      (story.slug.startsWith('draft-') || story.slug === slugOf(story.title))),
);
let creditText = $state({
  writer: story.credits.writer.join(', '),
  photographer: story.credits.photographer.join(', '),
  artist: story.credits.artist.join(', '),
});
let tagText = $state(story.tags.join(', '));

let saveState = $state<'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict'>(
  story.id ? 'saved' : 'idle',
);
let savedAt = $state<number | null>(story.updatedAt);
let savedBy = $state<string | null>(story.savedBy);
let errors = $state<Record<string, string>>({});
let conflict = $state<{ by: string | null } | null>(null);
let others = $state<Array<{ name: string }>>([]);
let schedule = $state<'now' | 'later' | 'keep'>(story.status === 'draft' ? 'now' : 'keep');
let scheduledFor = $state<string | null>(
  story.status === 'scheduled' && story.publishedAt
    ? new Date(story.publishedAt).toISOString()
    : null,
);
let uploading = $state(false);
let notice = $state('');

let picker: MediaPicker;
let coverDialog: CoverDialog;
let scheduleDialog: ScheduleDialog;
let publishDialog: PublishDialog;
let blockList: BlockList;
let headlineEl: HTMLTextAreaElement;
let fileInput: HTMLInputElement;
let pickerTarget: 'cover' | number = 'cover';

const live = $derived(s.status === 'published');
const autosaves = $derived(!live && s.status !== 'archived');
const isOpinion = $derived(
  ['opinion', 'editorial', 'cartoon'].includes(s.kind) ||
    sections.find((x) => x.id === s.sectionId)?.slug === 'opinion',
);
const isSportsfest = $derived(
  tagText.split(',').some((t) => t.trim().toLowerCase() === 'sportsfest'),
);
const linkPrefix = $derived(
  `${host.split('.')[0]}…/${sections.find((x) => x.id === s.sectionId)?.slug ?? ''}/`,
);
const clock = (ms: number) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms));
const longDate = (ms: number) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms));

const status = $derived.by(() => {
  if (saveState === 'saving') return 'Saving…';
  if (saveState === 'error') return 'Couldn’t save. Check your connection; trying again shortly.';
  if (saveState === 'conflict') return 'Not saved: someone else saved a newer version.';
  if (!s.id) return 'Not saved yet. Drafts save on their own once you start typing.';
  if (live)
    return saveState === 'dirty'
      ? 'Published. Press Update to put your changes live.'
      : `Published${savedAt ? `, saved at ${clock(savedAt)}` : ''}`;
  const word =
    s.status === 'scheduled'
      ? `Scheduled for ${s.publishedAt ? longDate(s.publishedAt) : 'later'}`
      : s.status === 'archived'
        ? 'Archived'
        : 'Draft';
  if (saveState === 'dirty') return `${word}, unsaved changes`;
  return `${word}${savedAt ? `, saved at ${clock(savedAt)}` : ''}${savedBy && savedBy !== me ? ` by ${savedBy}` : ''}`;
});

const split = (t: string) =>
  t
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

function payload(force = false) {
  return {
    sectionId: s.sectionId,
    kind: s.kind,
    title: s.title,
    slug: s.slug,
    slugAuto,
    dek: s.dek,
    credits: {
      writer: split(creditText.writer),
      photographer: split(creditText.photographer),
      artist: split(creditText.artist),
    },
    body: { type: 'doc', content: items.map((i) => i.node) },
    coverId: s.cover?.id ?? null,
    cartoonOnTop: s.cartoonOnTop,
    writerPhoto: s.writerPhoto,
    videoUrl: s.videoUrl,
    tags: split(tagText),
    eventIds: isSportsfest ? s.eventIds : [],
    shareTitle: s.shareTitle,
    shareSummary: s.shareSummary,
    pinned: s.pinned,
    baseUpdatedAt: savedAt,
    force,
  };
}

let timer: ReturnType<typeof setTimeout> | null = null;
let inflight: Promise<boolean> | null = null;

/** Saves now. Resolves true when the server has the latest version. */
async function save(force = false): Promise<boolean> {
  if (inflight) await inflight;
  if (!s.title.trim() && !s.id && items.every((i) => !JSON.stringify(i.node).includes('"text"')))
    return true;
  saveState = 'saving';
  inflight = (async () => {
    try {
      const res = await fetch(s.id ? `/api/admin/stories/${s.id}` : '/api/admin/stories', {
        method: s.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload(force)),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        conflict = data.conflict ?? { by: null };
        saveState = 'conflict';
        return false;
      }
      if (!res.ok || !data.ok) {
        errors = data.errors ?? {};
        saveState = Object.keys(errors).length ? 'dirty' : 'error';
        if (!Object.keys(errors).length) schedule_retry();
        return false;
      }
      errors = {};
      conflict = null;
      const first = !s.id;
      s.id = data.id;
      s.slug = data.slug;
      s.status = data.status;
      savedAt = data.updatedAt;
      savedBy = data.by ?? me;
      saveState = 'saved';
      if (first) history.replaceState(null, '', `/admin/stories/${data.id}`);
      return true;
    } catch {
      saveState = 'error';
      schedule_retry();
      return false;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

function schedule_retry() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => save(), 8000);
}

/** Every edit marks the story changed; drafts save themselves a moment after typing stops. */
function changed() {
  if (saveState === 'conflict') return;
  saveState = 'dirty';
  if (!autosaves) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => save(), 1200);
}

// Watch everything that is saved.
let ready = false;
$effect(() => {
  JSON.stringify([
    s.sectionId,
    s.kind,
    s.title,
    s.slug,
    s.dek,
    s.cover?.id,
    s.cartoonOnTop,
    s.writerPhoto,
    s.videoUrl,
    s.eventIds,
    s.shareTitle,
    s.shareSummary,
    s.pinned,
    creditText,
    tagText,
    items,
  ]);
  if (ready) changed();
  ready = true;
});

// While a headline is typed, the link follows it until someone edits the link by hand.
$effect(() => {
  if (slugAuto && !live) {
    s.slug = s.title
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }
});

let presence: ReturnType<typeof setInterval> | null = null;
async function ping() {
  if (!s.id) return;
  try {
    const res = await fetch(`/api/admin/stories/${s.id}/presence`, { method: 'POST' });
    const data = await res.json();
    others = data.others ?? [];
  } catch {
    // Presence is a courtesy; failing quietly is fine.
  }
}

function beforeUnload(event: BeforeUnloadEvent) {
  if (saveState === 'dirty' || saveState === 'saving' || saveState === 'error')
    event.preventDefault();
}

onMount(() => {
  ping();
  presence = setInterval(ping, 30_000);
  window.addEventListener('beforeunload', beforeUnload);
  autoGrow();
});
onDestroy(() => {
  if (presence) clearInterval(presence);
  if (timer) clearTimeout(timer);
  if (typeof window !== 'undefined') window.removeEventListener('beforeunload', beforeUnload);
});

function autoGrow() {
  if (!headlineEl) return;
  headlineEl.style.height = 'auto';
  headlineEl.style.height = `${headlineEl.scrollHeight}px`;
}

/* Publishing */

const action = $derived(
  live ? 'Update' : schedule === 'later' && scheduledFor ? 'Schedule' : 'Publish',
);

async function startPublish() {
  if (live) {
    if (await save()) location.href = `/admin/stories/${s.id}?done=saved`;
    return;
  }
  if (!(await save())) return;
  const res = await fetch(`/api/admin/stories/${s.id}/publish`);
  const data = await res.json();
  publishDialog.open(data.checks ?? []);
}

async function publish() {
  const at = schedule === 'later' ? scheduledFor : null;
  const res = await fetch(`/api/admin/stories/${s.id}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ at }),
  });
  const data = await res.json().catch(() => ({}));
  publishDialog.close();
  if (res.ok && data.ok)
    location.href = `/admin/stories/${s.id}?done=${data.status === 'scheduled' ? 'scheduled' : 'published'}`;
  else if (data.checks) publishDialog.open(data.checks);
  else notice = 'Publishing didn’t go through. Try again.';
}

async function setState(intent: 'unpublish' | 'archive' | 'restore') {
  if (!s.id) return;
  const ask = {
    unpublish: 'Take this story off the site and move it to drafts?',
    archive: 'Archive this story? It disappears from the site but stays here.',
    restore: 'Bring this story back as a draft?',
  };
  if (!window.confirm(ask[intent])) return;
  await save();
  const res = await fetch(`/api/admin/stories/${s.id}/state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intent }),
  });
  if (res.ok)
    location.href = `/admin/stories/${s.id}?done=${intent === 'archive' ? 'archived' : intent === 'restore' ? 'restored' : 'unpublished'}`;
}

function fix(id: string) {
  if (id === 'alt' && s.cover) coverDialog.open(s.cover);
  else if (id === 'title' || id === 'long-title') headlineEl.focus();
  else if (id === 'basics') document.getElementById('summary')?.focus();
  else document.querySelector<HTMLElement>('.blocks .rt, .blocks input, .blocks textarea')?.focus();
}

/* Photos */

async function upload(file: File) {
  uploading = true;
  notice = '';
  const body = new FormData();
  body.append('file', file);
  try {
    const res = await fetch('/api/admin/media', { method: 'POST', body });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    return data.item as { id: number; key: string; alt: string; caption: string };
  } catch (e) {
    notice = e instanceof Error && e.message ? e.message : 'The photo didn’t upload. Try again.';
    return null;
  } finally {
    uploading = false;
  }
}

function setCover(item: { id: number; key: string; alt: string; caption: string }) {
  const cover: Cover = {
    id: item.id,
    key: item.key,
    alt: item.alt,
    caption: item.caption,
    credit: '',
    focalX: 0.5,
    focalY: 0.5,
  };
  s.cover = cover;
  coverDialog.open(cover);
}

async function chooseCoverFile(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const item = await upload(file);
  if (item) setCover(item);
}

function picked(item: { id: number; key: string; alt: string; caption: string }) {
  if (pickerTarget === 'cover') setCover(item);
  else
    blockList.add('image', pickerTarget, {
      mediaId: item.id,
      key: item.key,
      alt: item.alt,
      caption: item.caption,
    });
}
</script>

<div class="editor">
  <header class="ed-head">
    <div class="admin-title">
      <a class="admin-back" href="/admin/stories">All stories</a>
      <h1>{s.id ? 'Edit story' : 'New story'}</h1>
      <p aria-live="polite">{status}</p>
    </div>
    <div class="admin-actions">
      {#if s.id}
        <a class="btn btn-secondary" href={`/admin/stories/${s.id}/preview`} target="_blank" rel="noopener">{@html EyeIcon} Preview</a>
      {:else}
        <button class="btn btn-secondary" type="button" disabled>{@html EyeIcon} Preview</button>
      {/if}
      <button class="btn btn-sunrise" type="button" onclick={startPublish} disabled={!s.title.trim() || saveState === 'saving'}>{@html SendIcon} {action}</button>
    </div>
  </header>

  {#if others.length}
    <p class="banner" role="status">
      <span class="initials">{others[0].name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
      <span>{others.map((o) => o.name).join(' and ')} {others.length === 1 ? 'is' : 'are'} also editing this story. Changes are saved for both of you; if you both save over each other, you’ll be asked which to keep.</span>
      {#if s.id}<a class="text-link" href={`/admin/stories/${s.id}/preview`} target="_blank" rel="noopener">Open read-only</a>{/if}
    </p>
  {/if}
  {#if conflict}
    <div class="conflict" role="alert">
      <p>{conflict.by ?? 'Someone else'} saved this story after you opened it. Load their version, or keep yours and save over it.</p>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick={() => location.reload()}>Load their version</button>
        <button type="button" class="btn btn-primary" onclick={() => save(true)}>Keep mine</button>
      </div>
    </div>
  {/if}
  {#if notice}<p class="admin-error-summary" role="alert">{notice}</p>{/if}
  {#if s.status === 'archived'}
    <p class="banner grey">This story is archived and hidden from the site. <button type="button" class="link-button" onclick={() => setState('restore')}>Bring it back as a draft</button></p>
  {/if}

  <div class="columns main-narrow">
    <div class="panel main">
      <div class="field section-field">
        <label for="section">Section</label>
        <select id="section" bind:value={s.sectionId}>
          {#each sections.filter((x) => x.parentId === null) as top}
            <option value={top.id}>{top.name}</option>
            {#each sections.filter((x) => x.parentId === top.id) as sub}
              <option value={sub.id}>{top.name}: {sub.name}</option>
            {/each}
          {/each}
        </select>
      </div>
      <div class="field">
        <label for="headline">Headline</label>
        <textarea id="headline" class="headline" rows="1" maxlength="200" placeholder="Write a headline" bind:value={s.title} bind:this={headlineEl} oninput={autoGrow}></textarea>
        {#if errors.title}<p class="field-error">{errors.title}</p>{/if}
      </div>
      <div class="field">
        <label for="summary">Summary</label>
        <textarea id="summary" rows="2" maxlength="400" placeholder={s.kind === 'letter' ? 'The signature, like Anonymous, second year' : 'One or two sentences that say what the story is about.'} bind:value={s.dek}></textarea>
      </div>
      <div class="credits">
        <div class="field">
          <label for="credit-words">{isOpinion && s.cartoonOnTop ? 'Cartoon' : 'Words'}</label>
          {#if isOpinion && s.cartoonOnTop}
            <input id="credit-words" type="text" list="people" placeholder="Add names" bind:value={creditText.artist} />
          {:else}
            <input id="credit-words" type="text" list="people" placeholder="Add names" bind:value={creditText.writer} />
          {/if}
        </div>
        <div class="field">
          <label for="credit-photos">Photos</label>
          <input id="credit-photos" type="text" list="people" placeholder="Add names" bind:value={creditText.photographer} />
        </div>
        {#if !(isOpinion && s.cartoonOnTop)}
          <div class="field">
            <label for="credit-layout">Layout</label>
            <input id="credit-layout" type="text" list="people" placeholder="Add names" bind:value={creditText.artist} />
          </div>
        {:else}
          <div class="field">
            <label for="credit-words2">Words</label>
            <input id="credit-words2" type="text" list="people" placeholder="Add names" bind:value={creditText.writer} />
          </div>
        {/if}
        <datalist id="people">{#each people as p}<option value={p}></option>{/each}</datalist>
      </div>
      <p class="hint">Separate names with commas. A new name is added to Staff.</p>
      <hr />
      <div class="field">
        <span class="label">Body</span>
        {#if errors.body}<p class="field-error">{errors.body}</p>{/if}
        <BlockList
          bind:this={blockList}
          bind:items
          onaddphoto={(at) => {
            pickerTarget = at;
            picker.open();
          }}
        />
      </div>
    </div>

    <div class="side">
      {#if isOpinion}
        <section class="panel">
          <h2>Opinion layout</h2>
          <label class="switch">
            <input type="checkbox" bind:checked={s.cartoonOnTop} />
            <span class="switch-text"><strong>Cartoon on top</strong><span>Shows the cartoon full width above the headline, like a news photo. Turn off for the black opinion header with no image.</span></span>
          </label>
          <label class="switch">
            <input type="checkbox" bind:checked={s.writerPhoto} />
            <span class="switch-text"><strong>Writer’s photo</strong><span>Shows the writer’s photo beside the byline. The photo comes from Staff.</span></span>
          </label>
        </section>
      {/if}

      <section class="panel">
        <h2>{isOpinion && s.cartoonOnTop ? 'Cartoon' : 'Cover photo'}</h2>
        {#if s.cover}
          <button type="button" class="cover" onclick={() => s.cover && coverDialog.open(s.cover)} aria-label="Edit the cover photo’s description, crop and sharing">
            <img src={`/media/${s.cover.key}`} alt={s.cover.alt} />
          </button>
          {#if !s.cover.alt}<p class="field-error">Needs a description. Click the photo to add it.</p>{/if}
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick={() => fileInput.click()} disabled={uploading}>{@html UploadIcon} Replace</button>
            <button type="button" class="btn btn-danger" onclick={() => (s.cover = null)}>{@html TrashIcon} Remove</button>
          </div>
        {:else}
          <button type="button" class="cover empty" onclick={() => fileInput.click()} aria-label="Upload a cover photo"></button>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick={() => fileInput.click()} disabled={uploading}>{@html UploadIcon} {uploading ? 'Uploading…' : 'Upload a photo'}</button>
          </div>
        {/if}
        <button type="button" class="link-button" onclick={() => { pickerTarget = 'cover'; picker.open(); }}>Choose from the library</button>
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="visually-hidden" bind:this={fileInput} onchange={chooseCoverFile} tabindex="-1" />
      </section>

      <section class="panel">
        <h2>Details</h2>
        <div class="field">
          <label for="publish-date">Publish date</label>
          <select
            id="publish-date"
            value={schedule}
            onchange={(e) => {
              const v = e.currentTarget.value as 'now' | 'later' | 'keep';
              if (v === 'later') scheduleDialog.open(scheduledFor ? new Date(scheduledFor) : null);
              else schedule = v;
              e.currentTarget.value = schedule;
            }}
          >
            {#if s.status === 'draft' || s.status === 'archived'}<option value="now">Now, when I press Publish</option>{/if}
            {#if s.status !== 'draft' && s.status !== 'archived' && s.publishedAt}<option value="keep">{s.status === 'scheduled' ? 'Scheduled' : 'Published'} {longDate(s.publishedAt)}</option>{/if}
            {#if scheduledFor && schedule === 'later'}<option value="later">Goes live {longDate(Date.parse(scheduledFor))}</option>{:else}<option value="later">{live ? 'Change the date…' : 'Schedule for later…'}</option>{/if}
          </select>
          {#if s.status === 'scheduled' || live}
            <button type="button" class="link-button" onclick={() => setState('unpublish')}>Move to drafts</button>
          {/if}
        </div>
        <div class="field">
          <label for="link">Link</label>
          <div class="link">
            <span>{linkPrefix}</span>
            <input id="link" type="text" maxlength="80" value={s.slug} oninput={(e) => { slugAuto = false; s.slug = e.currentTarget.value; }} />
          </div>
          {#if errors.slug}<p class="field-error">{errors.slug}</p>{/if}
          <p class="hint">Made from the headline. Change it before publishing; changing it later breaks shared links.</p>
        </div>
        <div class="field">
          <label for="tags">Tags</label>
          <input id="tags" type="text" placeholder="Add tags" bind:value={tagText} />
          {#if errors.tags}<p class="field-error">{errors.tags}</p>{/if}
        </div>
        {#if isSportsfest && events.length}
          <fieldset class="events">
            <legend>Sportsfest events it covers</legend>
            {#each events.filter((e) => e.year === events[0].year) as e}
              <label class="check small">
                <input type="checkbox" checked={s.eventIds.includes(e.id)} onchange={(ev) => (s.eventIds = ev.currentTarget.checked ? [...s.eventIds, e.id] : s.eventIds.filter((x) => x !== e.id))} />
                {e.name}
              </label>
            {/each}
          </fieldset>
        {/if}
        <div class="field">
          <label for="kind">Kind</label>
          <select id="kind" bind:value={s.kind}>
            {#each KINDS as [value, label]}<option {value}>{label}</option>{/each}
          </select>
        </div>
        {#if s.kind === 'video'}
          <div class="field">
            <label for="video">Video link</label>
            <input id="video" type="url" placeholder="A YouTube or Google Drive link" bind:value={s.videoUrl} />
            {#if errors.videoUrl}<p class="field-error">{errors.videoUrl}</p>{/if}
          </div>
        {/if}
        {#if s.id}
          <a class="text-link" href={`/admin/stories/${s.id}/versions`}>Earlier versions</a>
        {/if}
      </section>

      <section class="panel">
        <h2>Placement</h2>
        <button type="button" class="pin" aria-pressed={s.pinned} onclick={() => (s.pinned = !s.pinned)}>
          <span class="pin-box">{@html PinIcon}</span>
          <span class="switch-text">
            <strong>{s.pinned ? 'Pinned as the top story' : 'Pin as the top story'}</strong>
            <span>Puts this story first on the homepage. Pinning it unpins the story that’s there now.</span>
          </span>
        </button>
        <p class="hint foot">Latest, the section page and the Sportsfest page (for stories tagged Sportsfest) update on their own when you publish.</p>
        {#if s.id && s.status !== 'archived'}
          <button type="button" class="link-button danger" onclick={() => setState('archive')}>Archive this story</button>
        {/if}
      </section>
    </div>
  </div>
</div>

<MediaPicker bind:this={picker} onpick={picked} />
<CoverDialog
  bind:this={coverDialog}
  {host}
  headline={s.title}
  summary={s.dek}
  bind:shareTitle={s.shareTitle}
  bind:shareSummary={s.shareSummary}
  onsaved={(c) => (s.cover = c)}
/>
<ScheduleDialog
  bind:this={scheduleDialog}
  allowPast={live}
  onschedule={async (iso) => {
    scheduledFor = iso;
    schedule = 'later';
    if (live && s.id) {
      await save();
      const res = await fetch(`/api/admin/stories/${s.id}/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ at: iso }) });
      if (res.ok) location.href = `/admin/stories/${s.id}?done=saved`;
    }
  }}
/>
<PublishDialog bind:this={publishDialog} {action} onpublish={publish} onfix={fix} />

<style>
  .editor {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .ed-head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }
  .banner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin: 0;
    padding: 12px 16px;
    border: 1px solid var(--ink);
    background: var(--sunrise);
    font-size: 14px;
  }
  .banner span:nth-child(2) {
    flex: 1;
  }
  .banner.grey {
    background: var(--grey-100);
    border-color: var(--grey-300);
  }
  .banner .initials {
    margin: 0;
    background: var(--white);
  }
  .conflict {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border: 1px solid var(--red);
    background: var(--white);
  }
  .conflict p {
    margin: 0;
    font-weight: 600;
  }
  .main {
    gap: 20px;
  }
  .section-field {
    max-width: 190px;
  }
  .admin textarea.headline,
  .headline {
    min-height: 0;
    overflow: hidden;
    resize: none;
    font-size: 30px;
    font-weight: 700;
    line-height: 34px;
    letter-spacing: -0.04em;
  }
  .credits {
    display: grid;
    gap: 12px;
  }
  hr {
    width: 100%;
    margin: 0;
    border: 0;
    border-top: 1px solid var(--grey-300);
  }
  .label {
    font-size: 14px;
    font-weight: 500;
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .side .panel {
    gap: 14px;
  }
  .cover {
    display: block;
    width: 100%;
    padding: 0;
    border: 1px solid var(--grey-300);
    background: var(--grey-100);
    cursor: pointer;
  }
  .cover img {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
  }
  .cover.empty {
    aspect-ratio: 16 / 9;
    border: 1px dashed var(--grey-600);
    background: var(--white);
  }
  .link {
    display: flex;
    align-items: stretch;
    border: 1px solid var(--grey-300);
  }
  .link span {
    display: flex;
    align-items: center;
    padding: 0 0 0 12px;
    font-size: 14px;
    color: var(--grey-600);
    white-space: nowrap;
  }
  .admin .link input {
    border: 0;
    padding-left: 2px;
  }
  .events {
    gap: 6px;
  }
  .pin {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 0;
    border: 0;
    background: none;
    text-align: left;
    cursor: pointer;
  }
  .pin-box {
    display: grid;
    place-items: center;
    flex: none;
    width: 38px;
    height: 38px;
    border: 1px solid var(--grey-300);
  }
  .pin[aria-pressed='true'] .pin-box {
    border-color: var(--ink);
    background: var(--sunrise);
  }
  .foot {
    padding-top: 12px;
    border-top: 1px solid var(--grey-300);
  }
  @media (min-width: 768px) {
    .credits {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
  @media (min-width: 1024px) {
    .main {
      padding: 36px;
    }
  }
</style>
