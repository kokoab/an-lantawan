<script lang="ts">
/**
 * One paragraph or list of the story, edited with bold, italics, underline and links.
 * Typing Enter, or pasting several paragraphs from Google Docs, hands the extra content
 * back so the story splits it into blocks of their own.
 */
import { Editor, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { onDestroy, onMount } from 'svelte';

let {
  node,
  placeholder = '',
  onchange,
  onremove,
  focusKey = 0,
}: {
  node: Record<string, unknown>;
  placeholder?: string;
  /** Called with every top-level node the editor now holds. */
  onchange: (nodes: Record<string, unknown>[]) => void;
  /** Backspace in an empty block. */
  onremove?: () => void;
  /** Bump to put the cursor at the end of this block. */
  focusKey?: number;
} = $props();

let element: HTMLDivElement;
let editor: Editor | null = null;
let last = '';
let empty = $state(true);

const keys = Extension.create({
  name: 'storyBlockKeys',
  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor: e }) => {
        if (e.isEmpty && onremove) {
          onremove();
          return true;
        }
        return false;
      },
      'Mod-k': ({ editor: e }) => {
        const current = e.getAttributes('link').href as string | undefined;
        const href = window.prompt(
          'Link to (starting with https://). Leave empty to remove the link.',
          current ?? 'https://',
        );
        if (href === null) return true;
        if (!href.trim() || href.trim() === 'https://')
          e.chain().focus().extendMarkRange('link').unsetLink().run();
        else if (/^(https:\/\/|mailto:|\/)/.test(href.trim()))
          e.chain().focus().extendMarkRange('link').setLink({ href: href.trim() }).run();
        return true;
      },
    };
  },
});

onMount(() => {
  last = JSON.stringify(node);
  editor = new Editor({
    element,
    injectCSS: false,
    extensions: [
      StarterKit.configure({
        code: false,
        codeBlock: false,
        strike: false,
        horizontalRule: false,
        heading: { levels: [2, 3, 4] },
        link: {
          openOnClick: false,
          autolink: true,
          protocols: ['https', 'mailto'],
          HTMLAttributes: { rel: 'noopener noreferrer', target: null },
        },
      }),
      keys,
    ],
    content: { type: 'doc', content: [node] },
    editorProps: { attributes: { class: 'rt' } },
    onUpdate: ({ editor: e }) => {
      const content = (e.getJSON().content ?? []) as Record<string, unknown>[];
      empty = e.isEmpty;
      last = JSON.stringify(content.length === 1 ? content[0] : content);
      onchange(content);
    },
  });
  empty = editor.isEmpty;
});

onDestroy(() => editor?.destroy());

// When the story replaces this block from outside (a split, an undo), show the new content.
$effect(() => {
  const next = JSON.stringify(node);
  if (editor && next !== last) {
    last = next;
    editor.commands.setContent({ type: 'doc', content: [node] }, { emitUpdate: false });
    empty = editor.isEmpty;
  }
});

// Focus synchronously (Tiptap's focus command waits a frame), so no keystroke goes astray.
$effect(() => {
  if (focusKey && editor) {
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.view.focus();
  }
});
</script>

<div class="rt-frame" class:empty data-placeholder={placeholder} bind:this={element}></div>

<style>
  .rt-frame :global(.rt) {
    min-height: 26px;
    outline: none;
    font-size: 16px;
    line-height: 26px;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  .rt-frame :global(.rt p) {
    margin: 0;
  }
  .rt-frame :global(.rt > * + *) {
    margin-top: 12px;
  }
  .rt-frame :global(.rt ul),
  .rt-frame :global(.rt ol) {
    margin: 0;
    padding-left: 22px;
  }
  .rt-frame :global(.rt a) {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .rt-frame :global(.rt h2),
  .rt-frame :global(.rt h3) {
    margin: 0;
    font-size: 20px;
  }
  .rt-frame.empty {
    position: relative;
  }
  .rt-frame.empty::before {
    content: attr(data-placeholder);
    position: absolute;
    inset: 0;
    color: var(--grey-600);
    pointer-events: none;
  }
</style>
