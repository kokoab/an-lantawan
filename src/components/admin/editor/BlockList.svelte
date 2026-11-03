<script lang="ts">
/**
 * The story body as a list of blocks: paragraphs, subheads, photos, pull quotes, info
 * boxes and charts, each with Move up, Move down and Remove. Older stories can also hold
 * lists, videos and dividers; those keep working here.
 */

import { flushSync } from 'svelte';
import TrashIcon from '../../../assets/icons/admin/trash.svg?raw';
import RichText from './RichText.svelte';

export interface Item {
  key: number;
  node: Record<string, any>;
}

let {
  items = $bindable(),
  onaddphoto,
}: {
  items: Item[];
  /** Asks the page to pick or upload a photo, then insert it at `index`. */
  onaddphoto: (index: number) => void;
} = $props();

let nextKey = Math.max(0, ...items.map((i) => i.key)) + 1;
let focusFor = $state<Record<number, number>>({});
const key = () => nextKey++;

const LABEL: Record<string, string> = {
  paragraph: 'Paragraph',
  heading: 'Subhead',
  blockquote: 'Pull quote',
  image: 'Photo',
  infoBox: 'Info box',
  chart: 'Chart',
  bulletList: 'List',
  orderedList: 'Numbered list',
  embed: 'Video',
  horizontalRule: 'Divider',
};

const text = (n: Record<string, any> | undefined): string =>
  (n?.content ?? [])
    .map((c: Record<string, any>) => (c.type === 'text' ? c.text : c.content ? text(c) : ''))
    .join('');

function focus(k: number) {
  focusFor = { ...focusFor, [k]: (focusFor[k] ?? 0) + 1 };
  // Mount and focus at once, so keys typed right after Enter land in the new block.
  flushSync();
  const block = document.querySelector<HTMLElement>(`[data-block="${k}"]`);
  if (block && !block.querySelector('.rt'))
    block.querySelector<HTMLElement>('input, textarea')?.focus();
}

export function add(type: string, at = items.length, attrs?: Record<string, unknown>) {
  const node: Record<string, unknown> =
    type === 'paragraph'
      ? { type: 'paragraph' }
      : type === 'heading'
        ? { type: 'heading', attrs: { level: 2 }, content: [] }
        : type === 'blockquote'
          ? { type: 'blockquote', content: [{ type: 'paragraph' }] }
          : type === 'infoBox'
            ? { type: 'infoBox', attrs: { title: '', rows: [{ label: '', text: '' }] } }
            : type === 'chart'
              ? {
                  type: 'chart',
                  attrs: {
                    title: '',
                    kind: 'bars',
                    rows: [{ label: '', value: '', highlight: false }],
                    source: '',
                  },
                }
              : { type, attrs };
  const item = { key: key(), node };
  items = [...items.slice(0, at), item, ...items.slice(at)];
  flushSync();
  focus(item.key);
}

function move(i: number, by: number) {
  const j = i + by;
  if (j < 0 || j >= items.length) return;
  const next = [...items];
  [next[i], next[j]] = [next[j], next[i]];
  items = next;
}

function remove(i: number) {
  const before = items[i - 1];
  items = items.filter((_, n) => n !== i);
  if (before) queueMicrotask(() => focus(before.key));
}

function setNode(i: number, node: Record<string, unknown>) {
  items = items.map((it, n) => (n === i ? { ...it, node } : it));
}

/** A rich block may come back as several nodes (Enter, or a paste); each becomes a block. */
function fromRich(i: number, nodes: Record<string, any>[]) {
  if (nodes.length <= 1) {
    setNode(i, nodes[0] ?? { type: 'paragraph' });
    return;
  }
  const replaced = nodes.map((node, n) => ({ key: n === 0 ? items[i].key : key(), node }));
  items = [...items.slice(0, i), ...replaced, ...items.slice(i + 1)];
  flushSync();
  focus(replaced[replaced.length - 1].key);
}

const setAttr = (i: number, name: string, value: unknown) =>
  setNode(i, { ...items[i].node, attrs: { ...items[i].node.attrs, [name]: value } });

function setRow(i: number, r: number, field: string, value: unknown) {
  const rows = [...items[i].node.attrs.rows];
  rows[r] = { ...rows[r], [field]: value };
  setAttr(i, 'rows', rows);
}
const addRow = (i: number, blank: Record<string, unknown>) =>
  setAttr(i, 'rows', [...items[i].node.attrs.rows, blank]);
const removeRow = (i: number, r: number) =>
  setAttr(
    i,
    'rows',
    items[i].node.attrs.rows.filter((_: unknown, n: number) => n !== r),
  );
</script>

<div class="blocks">
  {#each items as item, i (item.key)}
    {@const n = item.node}
    <section data-block={item.key} class="block" class:wide={n.type === 'image' || n.type === 'infoBox' || n.type === 'chart'} aria-label={LABEL[n.type] ?? 'Block'}>
      <header class="block-head">
        <span class="block-label">{LABEL[n.type] ?? 'Block'}</span>
        <span class="block-actions">
          <button type="button" class="link-button" onclick={() => move(i, -1)} disabled={i === 0}>Move up</button>
          <button type="button" class="link-button" onclick={() => move(i, 1)} disabled={i === items.length - 1}>Move down</button>
          <button type="button" class="link-button danger" onclick={() => remove(i)}>{@html TrashIcon} Remove</button>
        </span>
      </header>

      {#if n.type === 'paragraph' || n.type === 'bulletList' || n.type === 'orderedList'}
        <RichText
          node={n}
          placeholder={i === 0 && items.length === 1 ? 'Type here, or paste from Google Docs. Bold, italics and links come with it; headings become subheads.' : ''}
          onchange={(nodes) => fromRich(i, nodes)}
          onremove={items.length > 1 ? () => remove(i) : undefined}
          focusKey={focusFor[item.key] ?? 0}
        />
      {:else if n.type === 'heading'}
        <input
          class="subhead"
          type="text"
          aria-label="Subhead"
          value={text(n)}
          oninput={(e) => setNode(i, { type: 'heading', attrs: { level: n.attrs?.level ?? 2 }, content: e.currentTarget.value ? [{ type: 'text', text: e.currentTarget.value }] : [] })}
        />
      {:else if n.type === 'blockquote'}
        <textarea
          class="quote"
          rows="2"
          aria-label="Pull quote"
          value={text(n.content?.[0])}
          oninput={(e) => setNode(i, { type: 'blockquote', content: [{ type: 'paragraph', content: e.currentTarget.value ? [{ type: 'text', text: e.currentTarget.value }] : [] }] })}
        ></textarea>
      {:else if n.type === 'image'}
        {#if n.attrs?.key}<img class="photo" src={`/media/${n.attrs.key}`} alt="" />{/if}
        <input type="text" aria-label="Caption" placeholder="Caption" maxlength="500" value={n.attrs?.caption ?? ''} oninput={(e) => setAttr(i, 'caption', e.currentTarget.value)} />
        <input type="text" aria-label="Describe the photo" placeholder="Describe the photo for people who can’t see it" maxlength="300" value={n.attrs?.alt ?? ''} oninput={(e) => setAttr(i, 'alt', e.currentTarget.value)} />
      {:else if n.type === 'infoBox'}
        <div class="field">
          <label for={`box-${item.key}`}>Box title</label>
          <input id={`box-${item.key}`} type="text" maxlength="120" value={n.attrs.title} oninput={(e) => setAttr(i, 'title', e.currentTarget.value)} />
        </div>
        {#each n.attrs.rows as row, r}
          <div class="box-row">
            <input type="text" aria-label={`Row ${r + 1} label`} maxlength="80" value={row.label} oninput={(e) => setRow(i, r, 'label', e.currentTarget.value)} />
            <textarea rows="2" aria-label={`Row ${r + 1} text`} maxlength="600" value={row.text} oninput={(e) => setRow(i, r, 'text', e.currentTarget.value)}></textarea>
            <button type="button" class="link-button danger" onclick={() => removeRow(i, r)}>{@html TrashIcon} Remove</button>
          </div>
        {/each}
        <button type="button" class="link-button" onclick={() => addRow(i, { label: '', text: '' })}>Add a row</button>
      {:else if n.type === 'chart'}
        <div class="field">
          <label for={`chart-${item.key}`}>Chart title</label>
          <input id={`chart-${item.key}`} type="text" maxlength="120" value={n.attrs.title} oninput={(e) => setAttr(i, 'title', e.currentTarget.value)} />
        </div>
        <div class="field">
          <span class="label">Show as</span>
          <div class="segmented" role="radiogroup" aria-label="Show as">
            {#each [['bars', 'Bars'], ['line', 'Line'], ['table', 'Table']] as [value, label]}
              <button type="button" role="radio" aria-checked={n.attrs.kind === value} class:on={n.attrs.kind === value} onclick={() => setAttr(i, 'kind', value)}>{label}</button>
            {/each}
          </div>
        </div>
        <div class="chart-rows">
          <span class="label">Label</span><span class="label">Value</span><span class="label">Highlight</span><span></span>
          {#each n.attrs.rows as row, r}
            <input type="text" aria-label={`Row ${r + 1} label`} maxlength="60" value={row.label} oninput={(e) => setRow(i, r, 'label', e.currentTarget.value)} />
            <input type="text" inputmode="decimal" aria-label={`Row ${r + 1} value`} value={row.value} oninput={(e) => setRow(i, r, 'value', e.currentTarget.value)} />
            <label class="switch"><input type="checkbox" checked={row.highlight} onchange={(e) => setRow(i, r, 'highlight', e.currentTarget.checked)} /><span class="visually-hidden">Highlight row {r + 1}</span></label>
            <button type="button" class="link-button danger" aria-label={`Remove row ${r + 1}`} onclick={() => removeRow(i, r)}>{@html TrashIcon}</button>
          {/each}
        </div>
        <button type="button" class="link-button" onclick={() => addRow(i, { label: '', value: '', highlight: false })}>Add a row</button>
        <div class="field">
          <label for={`source-${item.key}`}>Source</label>
          <textarea id={`source-${item.key}`} rows="2" maxlength="300" value={n.attrs.source} oninput={(e) => setAttr(i, 'source', e.currentTarget.value)}></textarea>
        </div>
        <p class="hint">Highlighted rows use the yellow fill on the site.</p>
      {:else if n.type === 'embed'}
        <input type="url" aria-label="YouTube or Google Drive link" value={n.attrs?.url ?? ''} oninput={(e) => setAttr(i, 'url', e.currentTarget.value)} />
      {:else if n.type === 'horizontalRule'}
        <hr />
      {/if}
    </section>
  {/each}

  <div class="add">
    <span class="label">Add a block</span>
    <div class="add-buttons">
      <button type="button" class="btn btn-secondary" onclick={() => add('paragraph')}>Paragraph</button>
      <button type="button" class="btn btn-secondary" onclick={() => add('heading')}>Subhead</button>
      <button type="button" class="btn btn-secondary" onclick={() => onaddphoto(items.length)}>Photo</button>
      <button type="button" class="btn btn-secondary" onclick={() => add('blockquote')}>Pull quote</button>
      <button type="button" class="btn btn-secondary" onclick={() => add('infoBox')}>Info box</button>
      <button type="button" class="btn btn-secondary" onclick={() => add('chart')}>Chart</button>
    </div>
  </div>
</div>

<style>
  .blocks {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .block {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border: 1px solid var(--grey-300);
    background: var(--white);
  }
  .block:focus-within {
    border-color: var(--ink);
  }
  .block-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .block-label,
  .label {
    font-size: 13px;
    font-weight: 500;
    line-height: 16px;
    color: var(--grey-600);
  }
  .block-actions {
    display: flex;
    gap: 14px;
    opacity: 0;
  }
  .block:hover .block-actions,
  .block:focus-within .block-actions {
    opacity: 1;
  }
  .block-actions :global(svg),
  .box-row :global(svg),
  .chart-rows :global(svg) {
    width: 13px;
    height: 13px;
    vertical-align: -2px;
  }
  .block-actions button:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .block input.subhead {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .block textarea.quote {
    font-size: 19px;
    font-weight: 600;
    line-height: 26px;
  }
  .photo {
    width: 100%;
    max-height: 380px;
    object-fit: cover;
    border: 1px solid var(--grey-300);
  }
  .box-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .segmented {
    display: inline-flex;
    align-self: flex-start;
    border: 1px solid var(--grey-300);
  }
  .segmented button {
    padding: 8px 14px;
    border: 0;
    border-left: 1px solid var(--grey-300);
    background: var(--white);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .segmented button:first-child {
    border-left: 0;
  }
  .segmented .on {
    background: var(--ink);
    color: var(--white);
  }
  .chart-rows {
    display: grid;
    grid-template-columns: 1fr 1fr auto auto;
    align-items: center;
    gap: 8px 10px;
  }
  .add {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border: 1px dashed var(--grey-300);
  }
  .add-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  hr {
    width: 100%;
    margin: 4px 0;
    border: 0;
    border-top: 1px solid var(--grey-300);
  }
  @media (min-width: 768px) {
    .box-row {
      grid-template-columns: 140px 1fr auto;
      align-items: start;
    }
  }
</style>
