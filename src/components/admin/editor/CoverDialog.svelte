<script lang="ts">
/**
 * The cover photo dialog: tap the part of the photo to keep in view, describe it, credit
 * it, and see how it looks cropped and when shared on Facebook or Messenger.
 */
import CheckIcon from '../../../assets/icons/admin/check.svg?raw';
import CloseIcon from '../../../assets/icons/admin/close.svg?raw';

export interface Cover {
  id: number;
  key: string;
  alt: string;
  caption: string;
  credit: string;
  focalX: number;
  focalY: number;
}

let {
  host,
  headline,
  summary,
  shareTitle = $bindable(),
  shareSummary = $bindable(),
  onsaved,
}: {
  host: string;
  headline: string;
  summary: string;
  shareTitle: string;
  shareSummary: string;
  onsaved: (cover: Cover) => void;
} = $props();

let dialog: HTMLDialogElement;
let photo = $state<Cover | null>(null);
let saving = $state(false);
let error = $state('');

export function open(cover: Cover) {
  photo = { ...cover };
  error = '';
  dialog.showModal();
}

function pick(event: MouseEvent) {
  if (!photo) return;
  const r = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const clamp = (v: number) => Math.min(1, Math.max(0, Math.round(v * 100) / 100));
  photo.focalX = clamp((event.clientX - r.left) / r.width);
  photo.focalY = clamp((event.clientY - r.top) / r.height);
}

async function save() {
  if (!photo) return;
  if (!photo.alt.trim()) {
    error = 'Describe the photo for people who can’t see it.';
    return;
  }
  saving = true;
  error = '';
  try {
    const res = await fetch(`/api/admin/media/${photo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alt: photo.alt,
        caption: photo.caption,
        credit: photo.credit,
        focalX: photo.focalX,
        focalY: photo.focalY,
      }),
    });
    if (!res.ok) throw new Error();
    onsaved({ ...photo });
    dialog.close();
  } catch {
    error = 'The photo details didn’t save. Check your connection and try again.';
  } finally {
    saving = false;
  }
}

const position = $derived(photo ? `${photo.focalX * 100}% ${photo.focalY * 100}%` : '50% 50%');
</script>

<dialog bind:this={dialog} class="dialog wide" aria-labelledby="cover-title">
  {#if photo}
    <div class="dialog-head">
      <h2 id="cover-title">Cover photo</h2>
      <button type="button" class="dialog-close" aria-label="Close" onclick={() => dialog.close()}>{@html CloseIcon}</button>
    </div>
    <div class="cover-grid">
      <div class="left">
        <button type="button" class="focal" onclick={pick} aria-label="Tap the most important part of the photo">
          <img src={`/media/${photo.key}`} alt="" />
          <span class="ring" style:left={`${photo.focalX * 100}%`} style:top={`${photo.focalY * 100}%`}></span>
        </button>
        <p class="hint">Tap the most important part of the photo. Every crop below keeps it in view.</p>
        <div class="field">
          <label for="cover-alt">Describe the photo <span class="required">Required</span></label>
          <input id="cover-alt" type="text" maxlength="300" bind:value={photo.alt} aria-invalid={error && !photo.alt.trim() ? 'true' : undefined} />
          <p class="hint">Read aloud to people who can’t see the photo, and shown if it doesn’t load.</p>
        </div>
        <div class="row two">
          <div class="field">
            <label for="cover-caption">Caption</label>
            <textarea id="cover-caption" rows="2" maxlength="500" bind:value={photo.caption}></textarea>
          </div>
          <div class="field">
            <label for="cover-credit">Photo by</label>
            <input id="cover-credit" type="text" maxlength="120" bind:value={photo.credit} />
          </div>
        </div>
      </div>
      <div class="right">
        <p class="sub">How it’s cropped</p>
        <div class="crops">
          <figure><img class="c-lead" src={`/media/${photo.key}`} alt="" style:object-position={position} /><figcaption>Homepage lead</figcaption></figure>
          <figure><img class="c-card" src={`/media/${photo.key}`} alt="" style:object-position={position} /><figcaption>Card</figcaption></figure>
          <figure><img class="c-phone" src={`/media/${photo.key}`} alt="" style:object-position={position} /><figcaption>Phone</figcaption></figure>
        </div>
        <p class="sub">When shared on Facebook or Messenger</p>
        <div class="share">
          <img src={`/media/${photo.key}`} alt="" style:object-position={position} />
          <div class="share-text">
            <span class="host">{host.toUpperCase()}</span>
            <strong>{shareTitle || headline || 'Headline'}</strong>
            <span>{shareSummary || summary}</span>
          </div>
        </div>
        <div class="row two">
          <div class="field">
            <label for="share-title">Share title <span class="count">{(shareTitle || headline).length} / 70</span></label>
            <textarea id="share-title" rows="2" maxlength="70" placeholder={headline} bind:value={shareTitle}></textarea>
          </div>
          <div class="field">
            <label for="share-summary">Share summary <span class="count">{(shareSummary || summary).length} / 160</span></label>
            <textarea id="share-summary" rows="2" maxlength="160" placeholder="Uses the story summary" bind:value={shareSummary}></textarea>
          </div>
        </div>
      </div>
    </div>
    {#if error}<p class="field-error" role="alert">{error}</p>{/if}
    <div class="dialog-actions">
      <button type="button" class="btn btn-secondary" onclick={() => dialog.close()}>Cancel</button>
      <button type="button" class="btn btn-sunrise" onclick={save} disabled={saving}>{@html CheckIcon} {saving ? 'Saving…' : 'Save photo'}</button>
    </div>
  {/if}
</dialog>

<style>
  .cover-grid {
    display: grid;
    gap: 24px;
  }
  .left,
  .right {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }
  .focal {
    position: relative;
    padding: 0;
    border: 0;
    background: none;
    cursor: crosshair;
  }
  .focal img {
    width: 100%;
    max-height: 400px;
    object-fit: contain;
    background: var(--grey-100);
  }
  .ring {
    position: absolute;
    width: 48px;
    height: 48px;
    margin: -24px 0 0 -24px;
    border: 2px solid var(--white);
    border-radius: 50%;
    box-shadow: 0 0 0 1px rgb(10 10 10 / 0.6);
    pointer-events: none;
  }
  .ring::after {
    content: '';
    position: absolute;
    inset: 18px;
    border: 2px solid var(--ink);
    border-radius: 50%;
    background: var(--white);
  }
  .sub {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }
  .crops {
    display: grid;
    grid-template-columns: 2fr 1.3fr 1fr;
    gap: 12px;
    align-items: end;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--grey-300);
  }
  .crops figure {
    margin: 0;
  }
  .crops img {
    width: 100%;
    object-fit: cover;
    border: 1px solid var(--grey-300);
  }
  .c-lead {
    aspect-ratio: 16 / 9;
  }
  .c-card {
    aspect-ratio: 4 / 3;
  }
  .c-phone {
    aspect-ratio: 1;
  }
  figcaption {
    margin-top: 6px;
    font-size: 12px;
    color: var(--grey-600);
  }
  .share {
    border: 1px solid var(--grey-300);
  }
  .share img {
    width: 100%;
    aspect-ratio: 1.91 / 1;
    object-fit: cover;
  }
  .share-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 14px;
    background: var(--grey-100);
  }
  .host {
    font-size: 11px;
    color: var(--grey-600);
  }
  .share-text strong {
    font-size: 17px;
    line-height: 22px;
  }
  .share-text span:last-child {
    font-size: 13px;
    line-height: 18px;
    color: var(--grey-600);
  }
  .count {
    float: right;
    font-weight: 400;
    color: var(--grey-600);
  }
  @media (min-width: 1024px) {
    .cover-grid {
      grid-template-columns: 1.25fr 1fr;
    }
  }
</style>
