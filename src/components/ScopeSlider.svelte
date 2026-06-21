<script lang="ts">
  /** Discrete 3-stop slider for deck breadth. Accessible (role="slider",
   *  arrow keys / Home / End), with pointer-drag snapping and clickable stops. */
  import type { DeckScope } from '../lib/types'

  interface Stage {
    value: DeckScope
    label: string
    count: number
  }

  let {
    value,
    stages,
    onchange,
    label = 'Deck breadth',
  }: {
    value: DeckScope
    stages: Stage[]
    onchange: (v: DeckScope) => void
    label?: string
  } = $props()

  let track = $state<HTMLDivElement>()
  let dragging = $state(false)

  const index = $derived(Math.max(0, stages.findIndex((s) => s.value === value)))
  const last = $derived(stages.length - 1)

  /** Centre position of stop i along the inset track (accounts for thumb width). */
  function pos(i: number): string {
    const f = last > 0 ? i / last : 0
    return `calc(${f} * (100% - var(--thumb)) + var(--thumb) / 2)`
  }

  function select(i: number): void {
    const c = Math.max(0, Math.min(last, i))
    if (stages[c] && stages[c].value !== value) onchange(stages[c].value)
  }

  function indexFromClientX(clientX: number): number {
    if (!track) return index
    const r = track.getBoundingClientRect()
    const usable = r.width - 22 // thumb width; positions are inset by half each end
    const frac = usable > 0 ? (clientX - r.left - 11) / usable : 0
    return Math.round(Math.max(0, Math.min(1, frac)) * last)
  }

  function onKey(e: KeyboardEvent): void {
    let next = index
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = index + 1
        break
      case 'ArrowLeft':
      case 'ArrowDown':
        next = index - 1
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = last
        break
      default:
        return
    }
    e.preventDefault()
    select(next)
  }

  function onPointerDown(e: PointerEvent): void {
    dragging = true
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    select(indexFromClientX(e.clientX))
  }
  function onPointerMove(e: PointerEvent): void {
    if (dragging) select(indexFromClientX(e.clientX))
  }
  function endDrag(): void {
    dragging = false
  }
</script>

<div class="scope">
  <div
    class="scope__rail"
    role="slider"
    tabindex="0"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={last}
    aria-valuenow={index}
    aria-valuetext={stages[index]?.label}
    aria-orientation="horizontal"
    onkeydown={onKey}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={endDrag}
    onpointercancel={endDrag}
  >
    <div class="scope__track" bind:this={track}>
      <span class="scope__fill" style:width={pos(index)}></span>
      {#each stages as s, i (s.value)}
        <span class="scope__tick" class:is-passed={i <= index} style:left={pos(i)}></span>
      {/each}
      <span class="scope__thumb" class:is-dragging={dragging} style:left={pos(index)}></span>
    </div>
  </div>
  <div class="scope__labels">
    {#each stages as s, i (s.value)}
      <button
        type="button"
        class="scope__label"
        class:is-active={i === index}
        style:text-align={i === 0 ? 'left' : i === last ? 'right' : 'center'}
        tabindex="-1"
        aria-hidden="true"
        onclick={() => select(i)}
      >
        <span class="scope__name">{s.label}</span>
        <span class="scope__count t-num">{s.count}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .scope {
    --thumb: 22px;
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    width: 100%;
  }
  .scope__rail {
    padding: var(--s-2) 0;
    cursor: pointer;
    touch-action: none;
  }
  .scope__rail:focus-visible {
    outline: none;
    box-shadow: none; /* the focus ring lives on the thumb, not the whole rail */
  }
  .scope__rail:focus-visible .scope__thumb {
    box-shadow:
      0 0 0 2px var(--bg),
      0 0 0 4px var(--focus-ring);
  }
  .scope__track {
    position: relative;
    height: var(--thumb);
  }
  /* the visible bar runs down the middle of the track */
  .scope__track::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 4px;
    transform: translateY(-50%);
    border-radius: var(--r-pill);
    background: var(--surface-sunken);
    border: 1px solid var(--border);
  }
  .scope__fill {
    position: absolute;
    top: 50%;
    left: 0;
    height: 4px;
    transform: translateY(-50%);
    border-radius: var(--r-pill);
    background: var(--amber-strong);
    transition: width var(--dur-base) var(--ease-spring);
  }
  .scope__tick {
    position: absolute;
    top: 50%;
    width: 8px;
    height: 8px;
    border-radius: var(--r-pill);
    transform: translate(-50%, -50%);
    background: var(--surface-raised);
    border: 1px solid var(--border);
    transition:
      background var(--dur-base) var(--ease-standard),
      border-color var(--dur-base) var(--ease-standard);
  }
  .scope__tick.is-passed {
    background: var(--amber-strong);
    border-color: var(--amber-strong);
  }
  .scope__thumb {
    position: absolute;
    top: 50%;
    width: var(--thumb);
    height: var(--thumb);
    border-radius: var(--r-pill);
    transform: translate(-50%, -50%);
    background: var(--surface-raised);
    border: 2px solid var(--amber-strong);
    box-shadow: var(--shadow-1);
    transition:
      left var(--dur-base) var(--ease-spring),
      box-shadow var(--dur-fast) var(--ease-standard);
  }
  .scope__thumb.is-dragging {
    transition: box-shadow var(--dur-fast) var(--ease-standard);
    cursor: grabbing;
  }
  .scope__labels {
    display: flex;
  }
  .scope__label {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 0;
    color: var(--text-muted);
    transition: color var(--dur-base) var(--ease-standard);
  }
  .scope__label:nth-child(2) {
    align-items: center;
  }
  .scope__label:last-child {
    align-items: flex-end;
  }
  .scope__label:first-child {
    align-items: flex-start;
  }
  .scope__label:hover {
    color: var(--text-secondary);
  }
  .scope__label.is-active {
    color: var(--text);
  }
  .scope__name {
    font-size: var(--fs-caption);
    font-weight: var(--fw-medium);
  }
  .scope__count {
    font-size: var(--fs-micro);
    color: var(--text-faint);
    font-weight: var(--fw-medium);
  }
  .scope__label.is-active .scope__count {
    color: var(--amber-text);
  }
</style>
