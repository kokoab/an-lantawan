<script lang="ts">
/** The story's cover photo: chosen from the library or uploaded, kept in a hidden field. */
import MediaPicker from './MediaPicker.svelte';

let {
  name = 'coverId',
  initial = null,
}: { name?: string; initial?: { id: number; key: string; alt: string } | null } = $props();

let cover = $state(initial);
let picker: MediaPicker;
let field: HTMLInputElement;

function changed(next: typeof cover) {
  cover = next;
  queueMicrotask(() => field.dispatchEvent(new Event('input', { bubbles: true })));
}
</script>

<div class="field">
  <span class="label">Cover photo</span>
  {#if cover}
    <img class="cover" src={`/media/${cover.key}`} alt={cover.alt} />
  {:else}
    <p class="muted small">No cover. Stories without one show their headline only.</p>
  {/if}
  <div class="form-actions">
    <button type="button" class="btn btn-secondary btn-small" onclick={() => picker.open()}>{cover ? 'Change cover' : 'Choose a cover'}</button>
    {#if cover}
      <button type="button" class="link-button danger small" onclick={() => changed(null)}>Remove cover</button>
      <a class="small" href={`/admin/media/${cover.id}`} target="_blank" rel="noopener">Edit description and crop</a>
    {/if}
  </div>
  <input type="hidden" {name} value={cover?.id ?? ''} bind:this={field} />
</div>

<MediaPicker bind:this={picker} onpick={(item) => changed({ id: item.id, key: item.key, alt: item.alt })} />

<style>
  .cover {
    width: 100%;
    max-height: 220px;
    border: 1px solid var(--grey-300);
    object-fit: cover;
  }
</style>
