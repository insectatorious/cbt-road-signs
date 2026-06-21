<script lang="ts">
  import type { SignDefinition } from '../lib/types'

  let { sign }: { sign: SignDefinition } = $props()

  const RED = '#c8102e'
  const BLUE = '#0061a8'
  const GREEN = '#006b3c'

  // Choose a statutory-ish palette by category so the placeholder still reads
  // as the right family of sign while the official SVG is missing.
  const fillByCat: Record<string, string> = {
    mandatory: BLUE,
    information: BLUE,
    direction: GREEN,
  }
  const fill = $derived(fillByCat[sign.category])
  const isFilled = $derived(!!fill)
  const textColor = $derived(isFilled ? '#fff' : '#1a1a18')
  const octPts = '36,6 84,6 114,36 114,84 84,114 36,114 6,84 6,36'
</script>

<svg viewBox="0 0 120 120" class="ph" role="img" aria-label={sign.caption}>
  {#if sign.shape === 'octagon'}
    <polygon points={octPts} fill={RED} stroke="#fff" stroke-width="4" />
  {:else if sign.shape === 'triangle'}
    <polygon points="60,12 110,100 10,100" fill="#fff" stroke={RED} stroke-width="11" stroke-linejoin="round" />
  {:else if sign.shape === 'inverted-triangle'}
    <polygon points="10,24 110,24 60,110" fill="#fff" stroke={RED} stroke-width="11" stroke-linejoin="round" />
  {:else if sign.shape === 'diamond'}
    <polygon points="60,8 112,60 60,112 8,60" fill={fill ?? '#fff'} stroke={isFilled ? 'none' : RED} stroke-width="9" />
  {:else if sign.shape === 'rectangle'}
    <rect x="10" y="28" width="100" height="64" rx="5" fill={fill ?? '#fff'} stroke={isFilled ? 'none' : '#9a988f'} stroke-width="3" />
  {:else if sign.category === 'mandatory'}
    <circle cx="60" cy="60" r="54" fill={BLUE} />
  {:else}
    <circle cx="60" cy="60" r="52" fill="#fff" stroke={RED} stroke-width="13" />
  {/if}

  <text
    x="60"
    y={sign.shape === 'triangle' ? 90 : sign.shape === 'inverted-triangle' ? 56 : 66}
    text-anchor="middle"
    fill={textColor}
    font-family="ui-monospace, monospace"
    font-size="17"
    font-weight="600">{sign.diagram ?? '?'}</text>
</svg>

<style>
  .ph {
    width: 100%;
    height: 100%;
  }
</style>
