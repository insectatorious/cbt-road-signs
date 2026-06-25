<script lang="ts">
  /** A compact column chart of reviews due per day. Bar 0 is "Today" (it includes
   *  any overdue) and is drawn in the accent colour; the rest are the forward plan.
   *  Data is computed by stats.buildForecast — this component only draws it. */
  import { startOfDay } from '../lib/scheduler'

  let {
    buckets,
    now,
    shown = true,
  }: { buckets: number[]; now: number; shown?: boolean } = $props()

  const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const day0 = $derived(startOfDay(now))
  const max = $derived(Math.max(1, ...buckets))
  const forward = $derived(buckets.reduce((a, b) => a + b, 0) - (buckets[0] ?? 0))

  /** local calendar date for column i — stepped via setDate so the weekday stays
   *  correct across a DST change (a fixed i*DAY_MS offset would drift by an hour). */
  function dateFor(i: number): Date {
    const d = new Date(day0)
    d.setDate(d.getDate() + i)
    return d
  }
  /** label today + every other day, to stay legible on a narrow screen */
  function tick(i: number): string {
    if (i === 0) return 'today'
    return i % 2 === 0 ? WEEKDAY[dateFor(i).getDay()] : ''
  }
  function when(i: number): string {
    return i === 0 ? 'today' : i === 1 ? 'tomorrow' : `in ${i} days`
  }
  /** proportional height, with a small floor so a busy "today" never hides a
   *  non-empty forward day entirely */
  function heightPct(count: number): number {
    return count <= 0 ? 0 : Math.max(8, Math.round((count / max) * 100))
  }
</script>

<div
  class="fc"
  role="img"
  aria-label={`Upcoming reviews: ${buckets[0] ?? 0} due now, ${forward} scheduled over the following ${Math.max(0, buckets.length - 1)} days`}
>
  {#each buckets as count, i}
    <div class="fc__col">
      <div class="fc__bar" title={`${count} due ${when(i)}`}>
        <div
          class="fc__fill"
          class:fc__fill--today={i === 0}
          style="height:{shown ? heightPct(count) : 0}%"
        ></div>
      </div>
      <span class="fc__tick" aria-hidden="true">{tick(i)}</span>
    </div>
  {/each}
</div>

<style>
  .fc {
    display: flex;
    align-items: flex-start;
    gap: 3px;
  }
  .fc__col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .fc__bar {
    width: 100%;
    height: 84px;
    display: flex;
    align-items: flex-end;
  }
  .fc__fill {
    width: 100%;
    border-radius: var(--r-sm) var(--r-sm) 0 0;
    background: var(--stone-50);
    transition: height 0.6s var(--ease-standard);
  }
  .fc__fill--today {
    background: var(--accent);
  }
  .fc__tick {
    font-size: 11px;
    line-height: 1.1;
    color: var(--text-faint);
    white-space: nowrap;
  }
  @media (prefers-reduced-motion: reduce) {
    .fc__fill {
      transition: none;
    }
  }
</style>
