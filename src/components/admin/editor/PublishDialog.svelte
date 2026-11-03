<script lang="ts">
/** “Before you publish”: what must be fixed, what to check, and what is already fine. */
import CloseIcon from '../../../assets/icons/admin/close.svg?raw';
import SendIcon from '../../../assets/icons/admin/send.svg?raw';

export interface Check {
  id: string;
  level: 'problem' | 'warning' | 'ok';
  text: string;
  fix?: string;
}

let {
  action,
  onpublish,
  onfix,
}: {
  /** “Publish” or “Schedule”. */
  action: string;
  onpublish: () => void;
  onfix: (id: string) => void;
} = $props();

let dialog: HTMLDialogElement;
let checks = $state<Check[]>([]);
let busy = $state(false);

export function open(list: Check[]) {
  checks = list;
  busy = false;
  dialog.showModal();
}
export const close = () => dialog.close();

const problems = $derived(checks.filter((c) => c.level === 'problem').length);
const warnings = $derived(checks.filter((c) => c.level === 'warning').length);
const lead = $derived(
  problems || warnings
    ? `${[problems && `${problems} ${problems === 1 ? 'thing' : 'things'} to fix`, warnings && `${warnings} to check`].filter(Boolean).join(' and ')}. Everything else is ready.`
    : 'Everything is ready.',
);
</script>

<dialog bind:this={dialog} class="dialog" aria-labelledby="publish-title">
  <div class="dialog-head">
    <div>
      <h2 id="publish-title">Before you publish</h2>
      <p>{lead}</p>
    </div>
    <button type="button" class="dialog-close" aria-label="Close" onclick={() => dialog.close()}>{@html CloseIcon}</button>
  </div>
  <ul class="checks">
    {#each checks as c}
      <li class={c.level}>
        <span class="mark" aria-hidden="true">{c.level === 'problem' ? '×' : c.level === 'warning' ? '!' : '✓'}</span>
        <span class="visually-hidden">{c.level === 'problem' ? 'Needs fixing:' : c.level === 'warning' ? 'Check:' : 'Ready:'}</span>
        <span class="text">{c.text}</span>
        {#if c.fix && c.level !== 'ok'}
          <button
            type="button"
            class="link-button"
            class:danger={c.level === 'problem'}
            onclick={() => {
              dialog.close();
              onfix(c.id);
            }}>{c.fix}</button>
        {/if}
      </li>
    {/each}
  </ul>
  <div class="dialog-actions">
    {#if problems}<span class="muted small">Fix {problems} {problems === 1 ? 'problem' : 'problems'} to {action.toLowerCase()}.</span>{/if}
    <button type="button" class="btn btn-secondary" onclick={() => dialog.close()}>Back to editing</button>
    <button
      type="button"
      class="btn btn-sunrise"
      disabled={problems > 0 || busy}
      onclick={() => {
        busy = true;
        onpublish();
      }}>{@html SendIcon} {busy ? 'Working…' : action}</button>
  </div>
</dialog>

<style>
  .checks {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .checks li {
    display: grid;
    grid-template-columns: 22px 1fr auto;
    align-items: start;
    gap: 12px;
    padding-block: 14px;
    border-top: 1px solid var(--grey-300);
    font-size: 15px;
    line-height: 22px;
  }
  .mark {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border: 1px solid var(--grey-300);
    font-size: 13px;
    font-weight: 700;
  }
  .problem .mark {
    border-color: var(--red);
    background: var(--red);
    color: var(--white);
  }
  .warning .mark {
    border-color: var(--ink);
    background: #ffd400;
  }
  .problem .text,
  .warning .text {
    font-weight: 600;
  }
  .ok .text {
    color: var(--grey-600);
  }
  .dialog-actions .muted {
    margin-right: auto;
  }
</style>
