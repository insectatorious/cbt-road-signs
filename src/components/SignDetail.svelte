<script lang="ts">
  import SignPlate from './SignPlate.svelte'
  import Icon from './Icon.svelte'
  import BookmarkButton from './BookmarkButton.svelte'
  import { reviewFor, lookalikesFor } from '../lib/store.svelte'
  import { accuracyOf, isMastered } from '../lib/stats'
  import { humanInterval, pct } from '../lib/util'
  import { modal } from '../lib/a11y'
  import { CATEGORY_META, type SignDefinition } from '../lib/types'

  let {
    sign,
    onClose,
    onOpen,
  }: { sign: SignDefinition; onClose: () => void; onOpen: (id: string) => void } = $props()

  const review = $derived(reviewFor(sign.id))
  const confused = $derived(lookalikesFor(sign))
  let closeBtn = $state<HTMLButtonElement>()

  $effect(() => {
    closeBtn?.focus()
  })

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose()
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
<div class="sheet" role="dialog" aria-modal="true" aria-label={sign.caption}>
  <div class="sheet__actions">
    <BookmarkButton id={sign.id} caption={sign.caption} variant="sheet" />
    <button class="sheet__close" onclick={onClose} bind:this={closeBtn} aria-label="Close">
      <Icon name="x" size={20} />
    </button>
  </div>

  <div class="sheet__art">
    <SignPlate {sign} />
  </div>

  <div class="sheet__body">
    <div class="sheet__chips">
      <span class="chip">{CATEGORY_META[sign.category].label}</span>
      {#if sign.diagram}<span class="chip chip--mono">{sign.diagram}</span>{/if}
      {#if isMastered(review)}<span class="chip chip--good">Mastered</span>{/if}
    </div>
    <h2 class="t-title">{sign.caption}</h2>
    <p class="explain">{sign.explanation}</p>

    {#if sign.mnemonic}
      <p class="mnemonic"><span class="t-micro">Memory aid</span>{sign.mnemonic}</p>
    {/if}

    {#if confused.length}
      <div class="block">
        <span class="t-micro">Often confused with</span>
        <div class="chips">
          {#each confused as c (c.id)}
            <button class="lookalike" onclick={() => onOpen(c.id)}>{c.caption}</button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="block">
      <span class="t-micro">Your progress</span>
      {#if review?.introduced}
        <div class="progress">
          <span><strong class="t-num">{pct(accuracyOf(review))}</strong> accuracy</span>
          <span><strong class="t-num">{review.timesSeen}</strong> seen</span>
          <span>next in <strong class="t-num">{humanInterval(review.intervalDays)}</strong></span>
        </div>
      {:else}
        <p class="t-caption">Not studied yet.</p>
      {/if}
    </div>

    <div class="block">
      <span class="t-micro">Source</span>
      {#if sign.source}
        <a class="source" href={sign.source} target="_blank" rel="noopener noreferrer">
          <Icon name="external" size={14} />
          Official artwork on Wikimedia Commons {#if sign.diagram}· TSRGD {sign.diagram}{/if}
        </a>
        <span class="source-note t-caption">Crown copyright, reproduced under the Open Government Licence v3.0.</span>
      {:else}
        <a
          class="source"
          href="https://www.gov.uk/guidance/the-highway-code/road-markings"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="external" size={14} />
          Highway Code — road markings &amp; signals
        </a>
        <span class="source-note t-caption">
          <strong>Illustration, not official artwork.</strong> Road markings and signals have no single
          standard sign image, so this is drawn in-app to match the Highway Code — use it as a guide,
          not a pixel-exact reference.
        </span>
      {/if}
    </div>
  </div>
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
    max-width: 460px;
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
  .sheet__actions {
    position: absolute;
    top: var(--s-3);
    right: var(--s-3);
    z-index: 1;
    display: flex;
    align-items: center;
    gap: var(--s-2);
  }
  .sheet__close {
    position: relative;
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: var(--r-pill);
    color: var(--text-muted);
  }
  /* Extend the tap target to >=44px (WCAG 2.5.5) without growing the glyph. */
  .sheet__close::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 44px;
    height: 44px;
    transform: translate(-50%, -50%);
  }
  .sheet__close:hover {
    background: var(--surface-hover);
    color: var(--text);
  }
  .sheet__art {
    width: 168px;
    margin: var(--s-2) auto var(--s-4);
  }
  .sheet__body {
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
  }
  .sheet__chips,
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s-2);
  }
  .chip {
    font-size: var(--fs-micro);
    letter-spacing: var(--ls-micro);
    font-weight: var(--fw-semibold);
    color: var(--text-muted);
    padding: 3px 9px;
    border: 1px solid var(--hairline);
    border-radius: var(--r-pill);
  }
  .chip--mono {
    font-family: var(--font-mono);
    text-transform: none;
  }
  .chip--good {
    color: var(--grade-good);
    border-color: color-mix(in srgb, var(--grade-good) 45%, var(--hairline));
  }
  .explain {
    color: var(--text-secondary);
    font-family: var(--font-reading);
  }
  .mnemonic {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: var(--s-3);
    border-left: 2px solid var(--accent);
    background: var(--accent-wash);
    border-radius: 0 var(--r-sm) var(--r-sm) 0;
    color: var(--text-secondary);
    font-size: var(--fs-callout);
  }
  .mnemonic :global(.t-micro) {
    color: var(--text-secondary);
  }
  .block {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    padding-top: var(--s-2);
    border-top: 1px solid var(--divider);
  }
  .lookalike {
    font-size: var(--fs-caption);
    color: var(--text-secondary);
    padding: 5px 11px;
    background: var(--surface-sunken);
    border: 1px solid var(--hairline);
    border-radius: var(--r-pill);
  }
  .lookalike:hover {
    border-color: var(--accent);
    color: var(--text);
  }
  .progress {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s-4);
    font-size: var(--fs-caption);
    color: var(--text-muted);
  }
  .progress strong {
    color: var(--text);
  }
  .source {
    display: inline-flex;
    align-items: center;
    gap: var(--s-2);
    align-self: flex-start;
    color: var(--text-secondary);
    font-size: var(--fs-caption);
    font-weight: var(--fw-medium);
  }
  .source:hover {
    color: var(--accent-ink);
  }
  .source-note {
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
