<script lang="ts">
  /** Renders a sign on its neutral passe-partout plate. Resolves the bundled
   *  official SVG, falls back to an in-app composite or a generated placeholder.
   *  The artwork is absolutely positioned inside the plate so it can never
   *  expand the plate beyond its square aspect-ratio. */
  import type { SignDefinition } from '../lib/types'
  import SignComposite from './SignComposite.svelte'
  import SignPlaceholder from './SignPlaceholder.svelte'

  let {
    sign,
    pad = true,
    tag = true,
  }: { sign: SignDefinition; pad?: boolean; tag?: boolean } = $props()

  const assets = import.meta.glob('../assets/signs/*.svg', {
    eager: true,
    query: '?url',
    import: 'default',
  }) as Record<string, string>

  const url = $derived(
    !sign.composite && sign.asset ? assets[`../assets/signs/${sign.asset}`] : undefined,
  )
</script>

<div class="plate">
  <div class="plate__inner" class:plate__inner--pad={pad}>
    {#if sign.composite}
      <SignComposite {sign} />
    {:else if url}
      <img src={url} alt={sign.caption} loading="lazy" draggable="false" />
    {:else}
      <SignPlaceholder {sign} />
    {/if}
  </div>
  {#if sign.composite && tag}
    <span class="plate__tag" title="In-app illustration — not the official sign artwork">illustration</span>
  {/if}
</div>

<style>
  .plate {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    background: var(--sign-plate);
    border: 1px solid var(--sign-plate-border);
    border-radius: var(--r-sm);
    overflow: hidden;
  }
  .plate__inner {
    position: absolute;
    inset: 4%;
  }
  .plate__inner--pad {
    inset: 9%;
  }
  .plate__inner :global(img) {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .plate__inner :global(svg),
  .plate__inner :global(.composite) {
    width: 100%;
    height: 100%;
  }
  /* marks in-app illustrations so they're never mistaken for official artwork */
  .plate__tag {
    position: absolute;
    right: 4%;
    bottom: 4%;
    padding: 2px 6px;
    border-radius: var(--r-pill);
    background: color-mix(in srgb, var(--sign-plate) 80%, transparent);
    border: 1px solid var(--sign-plate-border);
    color: #565550;
    font-size: 9px;
    line-height: 1;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    font-weight: 600;
    pointer-events: none;
  }
</style>
