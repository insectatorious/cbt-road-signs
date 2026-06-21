<script lang="ts">
  import SignPlate from './SignPlate.svelte'
  import { flip } from '../lib/motion'
  import { SIGN_BY_ID } from '../lib/store.svelte'
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

  let inner: HTMLElement

  $effect(() => {
    if (inner) flip(inner, flipped)
  })

  const confused = $derived(
    sign.confusedWith.map((id) => SIGN_BY_ID.get(id)).filter((s): s is SignDefinition => !!s),
  )
</script>

<div class="card">
  <div class="card__inner" bind:this={inner}>
    <!-- FRONT -->
    <button
      type="button"
      class="card__face card__face--front"
      disabled={flipped}
      aria-hidden={flipped}
      onclick={onflip}
    >
      {#if showHint}
        <span class="chip">{CATEGORY_META[sign.category].short}</span>
      {:else}
        <span></span>
      {/if}
      <div class="card__sign">
        <SignPlate {sign} />
      </div>
      <p class="reveal t-caption">Tap or press <kbd>Space</kbd> to reveal</p>
    </button>

    <!-- BACK — content is gated on `flipped` so the answer is NOT in the
         accessibility tree until revealed (preserves recall for SR users),
         and the aria-live region announces it when it mounts on flip. -->
    <div class="card__face card__face--back" aria-live="polite" aria-hidden={!flipped} inert={!flipped}>
      {#if flipped}
        <span class="chip chip--accent">{CATEGORY_META[sign.category].short}</span>
        <h2 class="answer t-title">{sign.caption}</h2>
        <p class="explain">{sign.explanation}</p>
        {#if sign.mnemonic}
          <p class="mnemonic"><span class="t-micro">Memory aid</span>{sign.mnemonic}</p>
        {/if}
        {#if confused.length}
          <div class="confused">
            <span class="t-micro">Often confused with</span>
            <div class="confused__chips">
              {#each confused as c (c.id)}
                <span class="lookalike">{c.caption}</span>
              {/each}
            </div>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .card {
    position: relative;
    width: 100%;
    max-width: 440px;
    margin: 0 auto;
    aspect-ratio: 5 / 6;
    perspective: 1600px;
  }
  .card__inner {
    position: absolute;
    inset: 0;
    transform-style: preserve-3d;
    will-change: transform;
  }
  .card__face {
    position: absolute;
    inset: 0;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    border: 1px solid var(--border);
    border-radius: var(--r-lg);
    background: var(--surface-raised);
    padding: var(--s-5);
    display: flex;
    flex-direction: column;
  }
  .card__face--front {
    cursor: pointer;
    align-items: center;
    justify-content: space-between;
    gap: var(--s-3);
    text-align: center;
  }
  .card__face--back {
    transform: rotateY(180deg);
    overflow-y: auto;
    gap: var(--s-3);
  }

  .card__sign {
    width: 100%;
    max-width: 248px;
    margin: auto;
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

  .chip {
    align-self: flex-start;
    font-size: var(--fs-micro);
    letter-spacing: var(--ls-micro);
    text-transform: uppercase;
    font-weight: var(--fw-semibold);
    color: var(--text-muted);
    padding: 3px 9px;
    border: 1px solid var(--hairline);
    border-radius: var(--r-pill);
  }
  .chip--accent {
    color: var(--amber-text);
    border-color: color-mix(in srgb, var(--amber) 40%, var(--hairline));
  }

  .answer {
    color: var(--text);
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
    border-left: 2px solid var(--amber);
    background: var(--amber-tint);
    border-radius: 0 var(--r-sm) var(--r-sm) 0;
    color: var(--text-secondary);
    font-size: var(--fs-callout);
  }
  .mnemonic :global(.t-micro) {
    color: var(--text-secondary);
  }
  .confused {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
  }
  .confused__chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s-2);
  }
  .lookalike {
    font-size: var(--fs-caption);
    color: var(--text-secondary);
    padding: 4px 10px;
    background: var(--surface-sunken);
    border: 1px solid var(--hairline);
    border-radius: var(--r-pill);
  }
</style>
