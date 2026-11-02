<script lang="ts">
/**
 * The story body editor. It writes the document as JSON into a hidden `body` field, so
 * the surrounding form saves it with everything else; the server cleans it again.
 */
import { Editor } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import { onDestroy, onMount } from 'svelte';
import MediaPicker from './MediaPicker.svelte';
import { StoryEmbed, StoryImage } from './nodes';

let { initial, name = 'body' }: { initial: string; name?: string } = $props();

let element: HTMLDivElement;
let field: HTMLInputElement;
let picker: MediaPicker;
let editor: Editor | null = $state(null);
// Bumped on every change so the toolbar re-reads which buttons are active.
let tick = $state(0);
let json = $state(initial);
let words = $state(0);
let notice = $state('');

const countWords = (e: Editor) => e.getText().split(/\s+/).filter(Boolean).length;

onMount(() => {
  editor = new Editor({
    element,
    injectCSS: false,
    extensions: [
      StarterKit.configure({
        code: false,
        codeBlock: false,
        strike: false,
        heading: { levels: [2, 3, 4] },
        link: {
          openOnClick: false,
          autolink: true,
          protocols: ['https', 'mailto'],
          HTMLAttributes: { rel: 'noopener noreferrer', target: null },
        },
      }),
      StoryImage,
      StoryEmbed,
    ],
    content: JSON.parse(initial),
    editorProps: { attributes: { class: 'ed-content', 'aria-label': 'Story text' } },
    onTransaction: () => {
      tick += 1;
    },
    onUpdate: ({ editor: e }) => {
      json = JSON.stringify(e.getJSON());
      words = countWords(e);
      // Tells the page there are unsaved changes.
      field.dispatchEvent(new Event('input', { bubbles: true }));
    },
  });
  words = countWords(editor);
});

onDestroy(() => editor?.destroy());

const active = (type: string, attrs?: Record<string, unknown>) => {
  void tick;
  return editor?.isActive(type, attrs) ?? false;
};
const chain = () => editor?.chain().focus();

function setLink() {
  if (!editor) return;
  const current = editor.getAttributes('link').href as string | undefined;
  const href = window.prompt(
    'Link to (a full address starting with https://, or leave empty to remove the link)',
    current ?? 'https://',
  );
  if (href === null) return;
  if (href.trim() === '' || href.trim() === 'https://') {
    chain()?.extendMarkRange('link').unsetLink().run();
    return;
  }
  if (!/^(https:\/\/|mailto:|\/)/.test(href.trim())) {
    notice = 'Links need to start with https://, mailto: or /.';
    return;
  }
  notice = '';
  chain()?.extendMarkRange('link').setLink({ href: href.trim() }).run();
}

function addVideo() {
  const url = window.prompt('Paste a YouTube or Google Drive link');
  if (!url) return;
  const provider = /drive\.google\.com/.test(url)
    ? 'drive'
    : /youtu\.?be/.test(url)
      ? 'youtube'
      : null;
  if (!provider) {
    notice = 'Only YouTube and Google Drive links can be embedded.';
    return;
  }
  notice = '';
  chain()
    ?.insertContent({ type: 'embed', attrs: { provider, url: url.trim() } })
    .run();
}

function insertPhoto(item: { id: number; key: string; alt: string; caption: string }) {
  chain()
    ?.insertContent({
      type: 'image',
      attrs: { mediaId: item.id, key: item.key, alt: item.alt, caption: item.caption },
    })
    .run();
}

// The photo whose details show in the panel, when one is selected.
const selectedImage = $derived.by(() => {
  void tick;
  const sel = editor?.state.selection;
  return sel instanceof NodeSelection && sel.node.type.name === 'image' ? sel.node : null;
});

function updateImage(attr: 'alt' | 'caption', value: string) {
  editor
    ?.chain()
    .updateAttributes('image', { [attr]: value })
    .run();
}
</script>

<div class="ed">
  <div class="ed-toolbar" role="toolbar" aria-label="Formatting">
    <button type="button" class:on={active('bold')} aria-pressed={active('bold')} onclick={() => chain()?.toggleBold().run()} title="Bold (Ctrl+B)"><strong>B</strong></button>
    <button type="button" class:on={active('italic')} aria-pressed={active('italic')} onclick={() => chain()?.toggleItalic().run()} title="Italic (Ctrl+I)"><em>I</em></button>
    <button type="button" class:on={active('underline')} aria-pressed={active('underline')} onclick={() => chain()?.toggleUnderline().run()} title="Underline (Ctrl+U)"><u>U</u></button>
    <button type="button" class:on={active('link')} aria-pressed={active('link')} onclick={setLink}>Link</button>
    <span class="sep" aria-hidden="true"></span>
    <button type="button" class:on={active('heading', { level: 2 })} aria-pressed={active('heading', { level: 2 })} onclick={() => chain()?.toggleHeading({ level: 2 }).run()}>Heading</button>
    <button type="button" class:on={active('heading', { level: 3 })} aria-pressed={active('heading', { level: 3 })} onclick={() => chain()?.toggleHeading({ level: 3 }).run()}>Subheading</button>
    <button type="button" class:on={active('blockquote')} aria-pressed={active('blockquote')} onclick={() => chain()?.toggleBlockquote().run()}>Quote</button>
    <button type="button" class:on={active('bulletList')} aria-pressed={active('bulletList')} onclick={() => chain()?.toggleBulletList().run()}>List</button>
    <button type="button" class:on={active('orderedList')} aria-pressed={active('orderedList')} onclick={() => chain()?.toggleOrderedList().run()}>Numbered</button>
    <button type="button" onclick={() => chain()?.setHorizontalRule().run()}>Divider</button>
    <span class="sep" aria-hidden="true"></span>
    <button type="button" onclick={() => picker.open()}>Photo</button>
    <button type="button" onclick={addVideo}>Video</button>
    <span class="sep" aria-hidden="true"></span>
    <button type="button" onclick={() => chain()?.undo().run()} title="Undo (Ctrl+Z)">Undo</button>
    <button type="button" onclick={() => chain()?.redo().run()} title="Redo (Ctrl+Shift+Z)">Redo</button>
  </div>

  {#if notice}<p class="field-error" role="alert">{notice}</p>{/if}

  {#if selectedImage}
    <div class="ed-panel">
      <div class="field">
        <label for="ed-alt">Photo description</label>
        <input id="ed-alt" type="text" maxlength="300" value={selectedImage.attrs.alt} oninput={(e) => updateImage('alt', e.currentTarget.value)} />
      </div>
      <div class="field">
        <label for="ed-caption">Caption</label>
        <input id="ed-caption" type="text" maxlength="500" value={selectedImage.attrs.caption} oninput={(e) => updateImage('caption', e.currentTarget.value)} />
      </div>
      <button type="button" class="btn btn-secondary btn-small" onclick={() => chain()?.deleteSelection().run()}>Remove photo</button>
    </div>
  {/if}

  <div class="ed-frame" bind:this={element}>
    {#if !editor}<p class="muted ed-loading">Loading the editor…</p>{/if}
  </div>
  <p class="muted small ed-count">{words} {words === 1 ? 'word' : 'words'}</p>
  <input type="hidden" {name} value={json} bind:this={field} />
</div>

<MediaPicker bind:this={picker} onpick={insertPhoto} />

<style>
  .ed {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ed-toolbar {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 6px;
    border: 1px solid var(--grey-300);
    background: var(--white);
  }
  .ed-toolbar button {
    min-width: 36px;
    padding: 6px 10px;
    border: 1px solid transparent;
    background: none;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  }
  .ed-toolbar button:hover {
    border-color: var(--grey-300);
  }
  .ed-toolbar button.on {
    background: var(--ink);
    color: var(--white);
  }
  .sep {
    width: 1px;
    margin: 4px 2px;
    background: var(--grey-300);
  }
  .ed-panel {
    display: grid;
    gap: 8px;
    align-items: end;
    padding: 12px;
    border: 1px solid var(--ink);
    background: var(--grey-50);
  }
  .ed-frame {
    min-height: 420px;
    border: 1px solid var(--grey-300);
    background: var(--white);
  }
  .ed-frame:focus-within {
    border-color: var(--ink);
  }
  .ed-loading {
    margin: 0;
    padding: 20px;
  }
  .ed-count {
    margin: 0;
    text-align: right;
  }
  .ed-frame :global(.ed-content) {
    min-height: 420px;
    max-width: 720px;
    padding: 24px;
    outline: none;
    font-size: 17px;
    line-height: 28px;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  .ed-frame :global(.ed-content > * + *) {
    margin-top: 16px;
  }
  .ed-frame :global(.ed-content p) {
    margin: 0;
  }
  .ed-frame :global(.ed-content h2) {
    margin: 32px 0 0;
    font-size: 26px;
    line-height: 32px;
    letter-spacing: -0.03em;
  }
  .ed-frame :global(.ed-content h3),
  .ed-frame :global(.ed-content h4) {
    margin: 24px 0 0;
    font-size: 20px;
    line-height: 26px;
  }
  .ed-frame :global(.ed-content blockquote) {
    margin: 0;
    padding-left: 16px;
    border-left: 3px solid var(--ink);
  }
  .ed-frame :global(.ed-content a) {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .ed-frame :global(.ed-content hr) {
    border: 0;
    border-top: 1px solid var(--grey-300);
  }
  .ed-frame :global(.ed-figure) {
    margin: 0;
  }
  .ed-frame :global(.ed-figure img) {
    max-height: 360px;
    border: 1px solid var(--grey-300);
  }
  .ed-frame :global(.ed-figure figcaption) {
    margin-top: 6px;
    font-size: 13px;
    color: var(--grey-600);
  }
  .ed-frame :global(.ed-embed) {
    padding: 16px;
    border: 1px dashed var(--grey-600);
    background: var(--grey-100);
    font-size: 14px;
    overflow-wrap: anywhere;
  }
  .ed-frame :global(.ProseMirror-selectednode) {
    outline: 3px solid #ffc700;
    outline-offset: 2px;
  }
  .ed-frame :global(.ProseMirror-gapcursor) {
    display: none;
    pointer-events: none;
    position: absolute;
  }
  .ed-frame :global(.ProseMirror-focused .ProseMirror-gapcursor) {
    display: block;
  }
  @media (min-width: 768px) {
    .ed-panel {
      grid-template-columns: 1fr 1fr auto;
    }
  }
</style>
