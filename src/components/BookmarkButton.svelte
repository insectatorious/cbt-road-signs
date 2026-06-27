<script lang="ts">
  /** Star toggle for saving a sign. Two variants:
   *  - 'sheet': a labelled pill ("Save" / "Saved") for the detail sheet header
   *  - 'card':  an icon-only corner star for the Reference grid cards
   *  State is shape + text (aria-pressed + label), never colour alone, so it reads
   *  for colour-blind and screen-reader users. Pointer/keyboard only — it binds no
   *  global hotkey, so it can't collide with Study's grading keys. */
  import Icon from './Icon.svelte'
  import { isBookmarked, toggleBookmark } from '../lib/store.svelte'

  let {
    id,
    caption,
    variant = 'sheet',
  }: { id: string; caption: string; variant?: 'sheet' | 'card' } = $props()

  const on = $derived(isBookmarked(id))

  function toggle(e: MouseEvent) {
    e.stopPropagation() // on a card, don't also open the detail sheet
    toggleBookmark(id)
  }
</script>

<button
  class="bm bm--{variant}"
  class:is-on={on}
  onclick={toggle}
  aria-pressed={on}
  aria-label={on ? `Saved: ${caption}. Tap to remove.` : `Save ${caption}`}
  title={on ? 'Saved — tap to remove' : 'Save this sign'}
>
  <Icon name="star" size={variant === 'sheet' ? 16 : 18} />
  {#if variant === 'sheet'}<span class="bm__label">{on ? 'Saved' : 'Save'}</span>{/if}
</button>

<style>
  .bm {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--s-2);
    color: var(--text-muted);
    transition:
      color var(--dur-fast) var(--ease-standard),
      background var(--dur-fast) var(--ease-standard);
  }
  /* CSS fill overrides the icon's fill="none" presentation attr when saved */
  .bm.is-on :global(svg) {
    fill: currentColor;
  }
  .bm.is-on {
    color: var(--accent);
  }

  .bm--sheet {
    height: 36px;
    padding: 0 var(--s-3);
    border: 1px solid var(--hairline);
    border-radius: var(--r-pill);
    font-size: var(--fs-caption);
    font-weight: var(--fw-medium);
  }
  .bm--sheet:hover {
    color: var(--text-secondary);
    background: var(--surface-hover);
  }
  .bm--sheet.is-on {
    border-color: color-mix(in srgb, var(--accent) 45%, var(--hairline));
    background: var(--accent-wash);
  }

  .bm--card {
    position: relative;
    width: 30px;
    height: 30px;
    border-radius: var(--r-pill);
    background: color-mix(in srgb, var(--surface) 70%, transparent);
    transition: opacity var(--dur-fast) var(--ease-standard);
  }
  /* Extend the tap target to >=44px (WCAG 2.5.5) without growing the glyph. */
  .bm--card::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 44px;
    height: 44px;
    transform: translate(-50%, -50%);
  }
  .bm--card:hover {
    color: var(--accent);
    background: var(--surface-hover);
  }
</style>
