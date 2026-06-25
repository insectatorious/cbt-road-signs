<script lang="ts">
  /** In-app illustrations for signs with no single official SVG:
   *  road markings, traffic-light signals, and worded direction panels. */
  import type { SignDefinition } from '../lib/types'
  import { COMPOSITE_ART } from '../lib/compositeArt'

  let { sign }: { sign: SignDefinition } = $props()

  // Data-driven illustrations (road markings / signals drawn by the workflow).
  // Rendered as a full <svg> via {@html} so the markup parses in the SVG
  // namespace; the content is our own static art, never user input.
  const art = $derived(COMPOSITE_ART[sign.id])
  const artSvg = $derived(
    art
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${art.viewBox}" width="100%" height="100%" role="img" aria-label="${sign.caption.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}">${art.inner}</svg>`
      : '',
  )

  const C = {
    tar: '#3b3b3d',
    line: '#f4f4f2',
    yellow: '#f2c200',
    red: '#c8102e',
    amber: '#f3920a',
    green: '#1f8a3b',
    blue: '#0061a8',
    house: '#1b1b1d',
  }

  // dashes for marking lines
  const dash = (x: number, ys: number[], w: number, h: number) =>
    ys.map((y) => ({ x, y, w, h }))
</script>

<div class="composite">
  {#if sign.id === 'traffic-light-sequence'}
    <svg viewBox="0 0 150 150" aria-label={sign.caption}>
      <rect x="53" y="8" width="44" height="134" rx="12" fill={C.house} />
      <circle cx="75" cy="34" r="15" fill={C.red} />
      <circle cx="75" cy="75" r="15" fill={C.amber} />
      <circle cx="75" cy="116" r="15" fill={C.green} />
    </svg>
  {:else if sign.id === 'green-filter-arrow'}
    <svg viewBox="0 0 150 150" aria-label={sign.caption}>
      <rect x="53" y="8" width="44" height="134" rx="12" fill={C.house} />
      <circle cx="75" cy="34" r="15" fill="#5a1414" />
      <circle cx="75" cy="75" r="15" fill="#5a4413" />
      <circle cx="75" cy="116" r="15" fill={C.green} />
      <path d="M67 116h12M79 108l9 8-9 8" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  {:else if sign.id === 'flashing-red-stop-lights'}
    <svg viewBox="0 0 150 110" aria-label={sign.caption}>
      <rect x="18" y="34" width="114" height="44" rx="10" fill={C.house} />
      <circle cx="50" cy="56" r="15" fill={C.red} />
      <circle cx="100" cy="56" r="15" fill={C.red} />
      <circle cx="50" cy="56" r="15" fill="none" stroke="#ff5b50" stroke-width="2" opacity="0.7" />
    </svg>
  {:else if sign.id === 'lane-control-signal'}
    <svg viewBox="0 0 140 140" aria-label={sign.caption}>
      <rect x="18" y="18" width="104" height="104" rx="12" fill={C.house} />
      <path d="M48 48l44 44M92 48L48 92" stroke={C.red} stroke-width="11" stroke-linecap="round" />
    </svg>

    <!-- ROAD MARKINGS (top-down on tarmac) -->
  {:else if sign.id === 'double-white-lines-solid-your-side'}
    <svg viewBox="0 0 150 150" aria-label={sign.caption}>
      <rect x="20" y="0" width="110" height="150" fill={C.tar} />
      <rect x="68" y="0" width="6" height="150" fill={C.line} />
      {#each dash(80, [8, 48, 88, 128], 6, 8) as d}
        <rect x={d.x} y={d.y} width={d.w} height={d.h} fill={C.line} />
      {/each}
    </svg>
  {:else if sign.id === 'hazard-warning-line'}
    <svg viewBox="0 0 150 150" aria-label={sign.caption}>
      <rect x="20" y="0" width="110" height="150" fill={C.tar} />
      {#each dash(72, [2, 40, 78, 116], 6, 28) as d}
        <rect x={d.x} y={d.y} width={d.w} height={d.h} fill={C.line} />
      {/each}
    </svg>
  {:else if sign.id === 'give-way-markings-at-junction'}
    <svg viewBox="0 0 150 150" aria-label={sign.caption}>
      <rect x="20" y="0" width="110" height="150" fill={C.tar} />
      {#each [28, 44, 60, 76, 92, 108] as x}
        <rect {x} y="40" width="9" height="9" fill={C.line} />
        <rect {x} y="54" width="9" height="9" fill={C.line} />
      {/each}
      <path d="M63 72h24L75 136z" fill="none" stroke={C.line} stroke-width="5" stroke-linejoin="round" />
    </svg>
  {:else if sign.id === 'zig-zag-lines-pedestrian-crossing'}
    <svg viewBox="0 0 150 150" aria-label={sign.caption}>
      <rect x="20" y="0" width="110" height="150" fill={C.tar} />
      {#each [0, 1, 2, 3] as i}
        <rect x="46" y={46 + i * 18} width="58" height="12" fill={C.line} />
      {/each}
      <polyline points="30,4 42,22 30,40 42,58 30,76 42,94 30,112 42,130 30,148" fill="none" stroke={C.line} stroke-width="4" />
      <polyline points="120,4 108,22 120,40 108,58 120,76 108,94 120,112 108,130 120,148" fill="none" stroke={C.line} stroke-width="4" />
    </svg>
  {:else if sign.id === 'yellow-box-junction'}
    <svg viewBox="0 0 150 150" aria-label={sign.caption}>
      <rect x="20" y="0" width="110" height="150" fill={C.tar} />
      <clipPath id="ybj"><rect x="34" y="24" width="82" height="102" /></clipPath>
      <g clip-path="url(#ybj)" stroke={C.yellow} stroke-width="2.5">
        {#each Array.from({ length: 16 }, (_, i) => -160 + i * 24) as o}
          <line x1={34 + o} y1="0" x2={34 + o + 150} y2="150" />
          <line x1={34 + o + 150} y1="0" x2={34 + o} y2="150" />
        {/each}
      </g>
      <rect x="34" y="24" width="82" height="102" fill="none" stroke={C.yellow} stroke-width="4" />
    </svg>

    <!-- DIRECTION PANELS (worded) -->
  {:else if sign.category === 'direction' || sign.id === 'with-flow-bus-lane'}
    {@const isGreen = sign.id === 'primary-route-direction-sign' || sign.id === 'route-confirmation-sign'}
    {@const isBus = sign.id === 'with-flow-bus-lane'}
    {@const bg = isBus ? C.blue : isGreen ? C.green : '#f4f4f2'}
    {@const fg = isBus || isGreen ? '#ffffff' : '#1a1a18'}
    {@const route = '#ffdd00'}
    <svg viewBox="0 0 210 120" aria-label={sign.caption}>
      <rect x="6" y="18" width="198" height="84" rx="6" fill={bg} stroke={isGreen || isBus ? 'none' : '#1a1a18'} stroke-width="3" />
      {#if isBus}
        <rect x="20" y="44" width="30" height="18" rx="3" fill="#fff" />
        <circle cx="27" cy="64" r="3.5" fill="#fff" /><circle cx="43" cy="64" r="3.5" fill="#fff" />
        <g fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="64" cy="64" r="7.5" /><circle cx="88" cy="64" r="7.5" />
          <path d="M64 64l8-13h9" /><path d="M72 51l8 13" /><path d="M80 64h8" /><path d="M85 51h7" />
        </g>
        <circle cx="76" cy="51" r="1.8" fill="#fff" />
        <text x="152" y="68" text-anchor="middle" fill={fg} font-family="var(--font-sans)" font-size="18" font-weight="700">BUS LANE</text>
      {:else if sign.id === 'route-confirmation-sign'}
        <text x="24" y="52" font-family="var(--font-sans)" font-size="16" font-weight="600">
          <tspan fill={route}>A40</tspan><tspan fill={fg} dx="8">Oxford 9</tspan>
        </text>
        <text x="24" y="84" font-family="var(--font-sans)" font-size="16" font-weight="600">
          <tspan fill={route}>A40</tspan><tspan fill={fg} dx="8">London 24</tspan>
        </text>
      {:else if sign.id === 'primary-route-direction-sign'}
        <text x="22" y="65" font-family="var(--font-sans)" font-size="15" font-weight="700">
          <tspan fill={route}>A40</tspan><tspan fill={fg} dx="7">The NORTH</tspan>
        </text>
        <path d="M164 60h22M178 52l10 8-10 8" fill="none" stroke={fg} stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
      {:else}
        <text x="24" y="65" fill={fg} font-family="var(--font-sans)" font-size="15" font-weight="600">
          {sign.id === 'local-direction-sign' ? 'Town Centre' : 'Riverside'}
        </text>
        <path d="M150 60h30M172 52l10 8-10 8" fill="none" stroke={fg} stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
      {/if}
    </svg>

    <!-- ROAD WORKS (worded/diagram) -->
  {:else if sign.id === 'lane-closed-ahead'}
    <svg viewBox="0 0 130 150" aria-label={sign.caption}>
      <rect x="8" y="8" width="114" height="134" rx="6" fill="#f4f4f2" stroke="#1a1a18" stroke-width="3" />
      <rect x="22" y="24" width="26" height="100" fill="#1a1a18" />
      <rect x="82" y="24" width="26" height="100" fill="#1a1a18" />
      <rect x="80" y="22" width="30" height="20" fill={C.red} />
      <path d="M95 110 L95 86 C95 66 80 60 64 60" fill="none" stroke="#1a1a18" stroke-width="8" stroke-linecap="round" />
      <path d="M70 47 L52 60 L70 73 Z" fill="#1a1a18" />
    </svg>
  {:else if sign.id === 'temporary-maximum-speed-ahead'}
    <svg viewBox="0 0 140 150" aria-label={sign.caption}>
      <rect x="8" y="8" width="124" height="134" rx="6" fill="#f2c200" stroke="#1a1a18" stroke-width="3" />
      <circle cx="70" cy="66" r="40" fill="#fff" stroke={C.red} stroke-width="10" />
      <text x="70" y="80" text-anchor="middle" font-family="var(--font-sans)" font-size="38" font-weight="700" fill="#1a1a18">50</text>
      <text x="70" y="128" text-anchor="middle" font-family="var(--font-sans)" font-size="16" font-weight="600" fill="#1a1a18">AHEAD</text>
    </svg>
  {:else if sign.id === 'end-of-road-works'}
    <svg viewBox="0 0 140 140" aria-label={sign.caption}>
      <rect x="10" y="20" width="120" height="100" rx="6" fill="#f4f4f2" stroke="#1a1a18" stroke-width="3" />
      <text x="70" y="80" text-anchor="middle" font-family="var(--font-sans)" font-size="32" font-weight="700" fill="#1a1a18">End</text>
    </svg>
  {:else if art}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- our own static art -->
    {@html artSvg}
  {:else}
    <!-- Unresolved composite: no hand-coded branch and no COMPOSITE_ART entry.
         `data-fallback` lets the render-guard test (tests/composite.test.ts)
         assert no composite sign ever lands here. -->
    <svg viewBox="0 0 140 140" aria-label={sign.caption} data-fallback="true">
      <rect x="14" y="14" width="112" height="112" rx="8" fill="#f4f4f2" stroke="#9a988f" stroke-width="3" />
      <text x="70" y="78" text-anchor="middle" font-family="var(--font-mono)" font-size="40" font-weight="600" fill="#9a988f">?</text>
    </svg>
  {/if}
</div>

<style>
  .composite {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .composite :global(svg) {
    width: 100%;
    height: 100%;
    max-height: 100%;
  }
</style>
