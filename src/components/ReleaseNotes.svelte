<script lang="ts">
  import Icon from './Icon.svelte'
  import { modal } from '../lib/a11y'
  import { CHANGELOG } from '../data/changelog'

  let { onClose }: { onClose: () => void } = $props()
  let closeBtn = $state<HTMLButtonElement>()

  $effect(() => {
    closeBtn?.focus()
  })

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose()
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  function fmt(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number)
    return `${d} ${MONTHS[(m || 1) - 1]} ${y}`
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="modal-root" use:modal>
<div
  class="overlay"
  role="button"
  tabindex="-1"
  aria-label="Close"
  onclick={onClose}
  onkeydown={(e) => e.key === 'Enter' && onClose()}
></div>
<div class="sheet" role="dialog" aria-modal="true" aria-label="Release notes">
  <button class="sheet__close" onclick={onClose} bind:this={closeBtn} aria-label="Close">
    <Icon name="x" size={20} />
  </button>

  <h2 class="t-title">Release notes</h2>
  <ol class="releases">
    {#each CHANGELOG as r, i (r.version)}
      <li class="release">
        <div class="release__head">
          <span class="release__ver t-num">v{r.version}</span>
          {#if i === 0}<span class="chip chip--latest">Latest</span>{/if}
          <span class="release__date t-caption">{fmt(r.date)}</span>
        </div>
        <ul class="release__changes">
          {#each r.changes as c}<li>{c}</li>{/each}
        </ul>
      </li>
    {/each}
  </ol>
</div>
</div>

<style>
  .modal-root {
    display: contents;
  }
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 90;
    background: color-mix(in srgb, var(--ink-100) 45%, transparent);
    backdrop-filter: blur(1px);
    animation: fade var(--dur-fast) var(--ease-standard);
  }
  .sheet {
    position: fixed;
    z-index: 91;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: 100%;
    max-width: 480px;
    max-height: 92dvh;
    overflow-y: auto;
    background: var(--surface-raised);
    border: 1px solid var(--border);
    border-radius: var(--r-lg) var(--r-lg) 0 0;
    padding: var(--s-5);
    box-shadow: var(--shadow-3);
    animation: rise var(--dur-base) var(--ease-standard);
  }
  @media (min-width: 600px) {
    .sheet {
      bottom: auto;
      top: 50%;
      transform: translate(-50%, -50%);
      border-radius: var(--r-lg);
      animation: pop var(--dur-base) var(--ease-standard);
    }
  }
  .sheet__close {
    position: absolute;
    top: var(--s-3);
    right: var(--s-3);
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: var(--r-pill);
    color: var(--text-muted);
  }
  .sheet__close:hover {
    background: var(--surface-hover);
    color: var(--text);
  }
  .releases {
    list-style: none;
    margin: var(--s-4) 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--s-5);
  }
  .release__head {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    padding-bottom: var(--s-2);
    border-bottom: 1px solid var(--divider);
  }
  .release__ver {
    font-weight: var(--fw-semibold);
    font-size: var(--fs-callout);
  }
  .release__date {
    margin-left: auto;
    color: var(--text-muted);
  }
  .chip--latest {
    font-size: var(--fs-micro);
    letter-spacing: var(--ls-micro);
    font-weight: var(--fw-semibold);
    color: var(--accent-ink);
    padding: 2px 8px;
    border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--hairline));
    border-radius: var(--r-pill);
  }
  .release__changes {
    margin: var(--s-3) 0 0;
    padding-left: var(--s-4);
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    color: var(--text-secondary);
    font-size: var(--fs-callout);
    line-height: 1.5;
  }
  .release__changes li::marker {
    color: var(--text-muted);
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  @keyframes rise {
    from {
      transform: translate(-50%, 16px);
      opacity: 0;
    }
  }
  @keyframes pop {
    from {
      transform: translate(-50%, -48%) scale(0.98);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .overlay,
    .sheet {
      animation: none;
    }
  }
</style>
