<script lang="ts">
  import { onMount } from 'svelte'
  import { countUp } from '../lib/motion'

  let {
    label,
    value,
    format = (n: number) => String(Math.round(n)),
    sub = '',
    accent = false,
  }: {
    label: string
    value: number
    format?: (n: number) => string
    sub?: string
    accent?: boolean
  } = $props()

  let numEl = $state<HTMLElement>()
  onMount(() => {
    if (numEl) countUp(numEl, value, format)
  })
</script>

<div class="stat">
  <span class="t-micro">{label}</span>
  <span class="stat__num t-num" class:stat__num--accent={accent} bind:this={numEl}>{format(0)}</span>
  {#if sub}<span class="stat__sub t-caption">{sub}</span>{/if}
</div>

<style>
  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--s-4);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    background: var(--surface);
  }
  .stat__num {
    font-size: var(--fs-stat);
    line-height: var(--lh-stat);
    font-weight: var(--fw-semibold);
    color: var(--text);
    margin-top: 4px;
  }
  .stat__num--accent {
    color: var(--accent-ink);
  }
  .stat__sub {
    margin-top: 2px;
  }
</style>
