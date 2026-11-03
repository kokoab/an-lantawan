<script lang="ts">
/** Pick a day and time for a story to go live by itself. Times are Philippine time. */
import CheckIcon from '../../../assets/icons/admin/check.svg?raw';
import CloseIcon from '../../../assets/icons/admin/close.svg?raw';

let { onschedule, allowPast = false }: { onschedule: (iso: string) => void; allowPast?: boolean } =
  $props();

let dialog: HTMLDialogElement;
const pad = (n: number) => String(n).padStart(2, '0');
// Today in Tacloban, as y-m-d.
const todayKey = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
let month = $state(todayKey().slice(0, 7));
let day = $state(todayKey());
let time = $state('08:00');

const TIMES = Array.from(
  { length: 48 },
  (_, i) => `${pad(Math.floor(i / 2))}:${i % 2 ? '30' : '00'}`,
);
const timeLabel = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
};
const dateOf = (key: string) => new Date(`${key}T12:00:00+08:00`);
const long = (key: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', ...opts }).format(dateOf(key));

const grid = $derived.by(() => {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [
    ...Array(first).fill(null),
    ...Array.from({ length: count }, (_, i) => `${month}-${pad(i + 1)}`),
  ];
});
const when = $derived(new Date(`${day}T${time}:00+08:00`));
const past = $derived(when.getTime() <= Date.now());

function shift(by: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  month = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

export function open(current: Date | null) {
  if (current) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(current);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
    day = `${get('year')}-${get('month')}-${get('day')}`;
    time = `${get('hour')}:${Number(get('minute')) >= 30 ? '30' : '00'}`;
  }
  month = day.slice(0, 7);
  dialog.showModal();
}
</script>

<dialog bind:this={dialog} class="dialog" aria-labelledby="schedule-title">
  <div class="dialog-head">
    <div>
      <h2 id="schedule-title">{allowPast ? 'Publication date' : 'Schedule publishing'}</h2>
      <p>{allowPast ? 'The date readers see on the story.' : 'The story goes live by itself. You can change or cancel this until then.'}</p>
    </div>
    <button type="button" class="dialog-close" aria-label="Close" onclick={() => dialog.close()}>{@html CloseIcon}</button>
  </div>
  <div class="calendar">
    <div class="cal-head">
      <strong>{long(`${month}-01`, { month: 'long', year: 'numeric' })}</strong>
      <span>
        <button type="button" class="link-button" onclick={() => shift(-1)}>Previous</button>
        <button type="button" class="link-button" onclick={() => shift(1)}>Next</button>
      </span>
    </div>
    <div class="days" role="grid" aria-label="Days">
      {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as d}<span class="dow">{d}</span>{/each}
      {#each grid as key}
        {#if key}
          <button
            type="button"
            class="day"
            class:today={key === todayKey()}
            class:picked={key === day}
            disabled={!allowPast && key < todayKey()}
            aria-pressed={key === day}
            onclick={() => (day = key)}
          >{Number(key.slice(8))}</button>
        {:else}
          <span></span>
        {/if}
      {/each}
    </div>
  </div>
  <div class="row two">
    <div class="field">
      <label for="schedule-time">Time</label>
      <select id="schedule-time" bind:value={time}>
        {#each TIMES as t}<option value={t}>{timeLabel(t)}</option>{/each}
      </select>
    </div>
    <div class="field">
      <label for="schedule-date">Date</label>
      <input id="schedule-date" type="text" readonly value={long(day, { weekday: 'long', month: 'long', day: 'numeric' })} />
    </div>
  </div>
  <p class="summary">
    {#if allowPast}
      Shows as {long(day, { month: 'long', day: 'numeric', year: 'numeric' })}, {timeLabel(time)}.
    {:else if past}
      That time has passed. Pick a later one, or publish now.
    {:else}
      Goes live {long(day, { weekday: 'long', month: 'long', day: 'numeric' })} at {timeLabel(time)}. Latest and the section page update then too.
    {/if}
  </p>
  <div class="dialog-actions">
    <button type="button" class="btn btn-secondary" onclick={() => dialog.close()}>Cancel</button>
    <button
      type="button"
      class="btn btn-sunrise"
      disabled={!allowPast && past}
      onclick={() => {
        dialog.close();
        onschedule(when.toISOString());
      }}
    >{@html CheckIcon} {allowPast ? 'Use this date' : 'Schedule'}</button>
  </div>
</dialog>

<style>
  .calendar {
    margin-bottom: 16px;
    padding: 14px;
    border: 1px solid var(--grey-300);
  }
  .cal-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .cal-head strong {
    font-size: 17px;
  }
  .cal-head span {
    display: flex;
    gap: 12px;
  }
  .days {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
    text-align: center;
  }
  .dow {
    padding: 4px 0;
    font-size: 13px;
    color: var(--grey-600);
  }
  .day {
    height: 36px;
    border: 1px solid transparent;
    background: none;
    font-size: 15px;
    cursor: pointer;
  }
  .day:hover {
    border-color: var(--grey-300);
  }
  .day:disabled {
    color: var(--grey-300);
    cursor: default;
  }
  .day.today {
    border-color: var(--grey-600);
  }
  .day.picked {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--white);
    font-weight: 700;
  }
  .summary {
    margin: 12px 0 0;
    font-size: 14px;
    line-height: 20px;
  }
</style>
