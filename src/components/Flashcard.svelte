<script lang="ts">
  import { onDestroy } from 'svelte'
  import { gsap } from 'gsap'
  import SignPlate from './SignPlate.svelte'
  import Icon from './Icon.svelte'
  import { revealAnswer, fadeUp } from '../lib/motion'
  import { lookalikesFor } from '../lib/store.svelte'
  import { CATEGORY_META, type SignDefinition } from '../lib/types'

  let {
    sign,
    flipped,
    showHint = true,
    onflip,
  }: {
    sign: SignDefinition
    flipped: boolean
    showHint?: boolean
    onflip: () => void
  } = $props()

  // Both panels only exist once their gate is true; as $state, the bind:this
  // assignment re-triggers the matching effect so the open animates on mount.
  let revealEl = $state<HTMLDivElement>()
  let detailsEl = $state<HTMLDivElement>()
  let showDetails = $state(false)

  const confused = $derived(lookalikesFor(sign))

  $effect(() => {
    if (flipped && revealEl) {
      revealAnswer(revealEl)
      fadeUp(Array.from(revealEl.children), { stagger: 0.04, y: 6 })
    }
  })

  $effect(() => {
    if (showDetails && detailsEl) revealAnswer(detailsEl)
  })

  onDestroy(() => {
    if (revealEl) gsap.killTweensOf(revealEl)
    if (detailsEl) gsap.killTweensOf(detailsEl)
  })
</script>

<!-- The sign is ALWAYS visible (it's the cue). Revealing the answer expands a
     panel BELOW it — the sign never moves or flips out of view, so the learner
     can verify their recall against the artwork while grading it. The meaning
     (caption) shows immediately; the rest sits behind a "Details" disclosure so
     the sign + caption + grade buttons all fit without scrolling on small phones. -->
<div class="card">
  {#if showHint}
    <span class="chip">{CATEGORY_META[sign.category].short}</span>
  {:else}
    <span class="chip-slot" aria-hidden="true"></span>
  {/if}

  <div class="card__sign">
    <SignPlate {sign} />
  </div>

  {#if flipped}
    <!-- Gated on `flipped`: the answer is absent from the DOM/a11y tree until
         revealed (preserves active recall for SR users); aria-live announces it. -->
    <div class="card__answer" bind:this={revealEl} aria-live="polite">
      <span class="chip chip--accent">{CATEGORY_META[sign.category].short}</span>
      <h2 class="answer t-title">{sign.caption}</h2>

      <button
        type="button"
        class="details-toggle"
        data-details-toggle
        aria-expanded={showDetails}
        onclick={() => (showDetails = !showDetails)}
      >
        <span>{showDetails ? 'Hide details' : 'Details'}</span>
        <span class="details-toggle__chev" class:details-toggle__chev--open={showDetails}>
          <Icon name="chevron" size={15} />
        </span>
      </button>

      {#if showDetails}
        <div class="card__details" bind:this={detailsEl}>
          <p class="explain">{sign.explanation}</p>
          {#if sign.mnemonic}
            <p class="mnemonic"><span class="t-micro">Memory aid</span>{sign.mnemonic}</p>
          {/if}
          {#if confused.length}
            <div class="confused">
              <span class="t-micro">Often confused with</span>
              <div class="confused__grid">
                {#each confused.slice(0, 4) as c (c.id)}
                  <figure class="lookalike">
                    <span class="lookalike__art" aria-hidden="true">
                      <SignPlate sign={c} pad={false} tag={false} />
                    </span>
                    <figcaption>{c.caption}</figcaption>
                  </figure>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {:else}
    <button type="button" class="card__revealhint" onclick={onflip} aria-label="Reveal answer">
      <span class="reveal t-caption">Tap or press <kbd>Space</kbd> to reveal</span>
    </button>
  {/if}
</div>

<style>
  .card {
    width: 100%;
    max-width: 440px;
    max-height: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
    border: 1px solid var(--border);
    border-radius: var(--r-lg);
    background: var(--surface-raised);
    padding: var(--s-5);
  }

  .card__sign {
    flex: 0 0 auto;
    width: 100%;
    max-width: 160px;
    margin: 0 auto;
  }

  /* Collapsed state: a tap target filling the space below the sign. */
  .card__revealhint {
    flex: 1 1 auto;
    min-height: 88px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    width: 100%;
    text-align: center;
  }
  .reveal {
    color: var(--text-faint);
  }
  .reveal kbd {
    font-family: var(--font-mono);
    font-size: 0.85em;
    padding: 1px 5px;
    border: 1px solid var(--border);
    border-radius: var(--r-xs);
  }

  /* Revealed state: pinned sign above, this panel scrolls if the details are
     expanded long, so the grade buttons (Study's .controls) stay above the fold. */
  .card__answer {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
    width: 100%;
  }

  .chip {
    align-self: flex-start;
    font-size: var(--fs-micro);
    letter-spacing: var(--ls-micro);
    font-weight: var(--fw-semibold);
    color: var(--text-muted);
    padding: 3px 9px;
    border: 1px solid var(--hairline);
    border-radius: var(--r-pill);
  }
  /* Keeps the sign vertically anchored when the category hint is off. */
  .chip-slot {
    height: calc(1em + 6px + 2px);
  }
  .chip--accent {
    color: var(--accent-ink);
    border-color: color-mix(in srgb, var(--accent) 40%, var(--hairline));
  }

  .answer {
    color: var(--text);
  }

  .details-toggle {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: var(--s-2);
    padding: var(--s-2) 0;
    color: var(--text-secondary);
    font-size: var(--fs-caption);
    font-weight: var(--fw-medium);
    cursor: pointer;
  }
  .details-toggle:hover {
    color: var(--text);
  }
  .details-toggle__chev {
    display: inline-flex;
    transform: rotate(90deg); /* the right-pointing chevron now points down */
    transition: transform var(--dur-base) var(--ease-standard);
  }
  .details-toggle__chev--open {
    transform: rotate(-90deg); /* points up when expanded */
  }

  .card__details {
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
  }
  .explain {
    color: var(--text-secondary);
    font-size: var(--fs-body);
    line-height: var(--lh-body);
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

  .confused {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    padding-top: var(--s-3);
    border-top: 1px solid var(--divider);
  }
  .confused__grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
    gap: var(--s-3);
  }
  .lookalike {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .lookalike__art {
    display: block;
  }
  .lookalike figcaption {
    font-size: var(--fs-micro);
    line-height: 1.25;
    text-align: center;
    color: var(--text-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
