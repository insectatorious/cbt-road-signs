<script lang="ts">
  let { points, height = 32 }: { points: number[]; height?: number } = $props()

  const W = 100
  const path = $derived.by(() => {
    if (points.length < 2) return ''
    const max = Math.max(1, ...points)
    return points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * W
        const y = height - (p / max) * (height - 3) - 1.5
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  })
</script>

<svg class="spark" viewBox="0 0 {W} {height}" preserveAspectRatio="none" aria-hidden="true">
  <path
    d={path}
    fill="none"
    stroke="var(--amber)"
    stroke-width="1.6"
    stroke-linejoin="round"
    stroke-linecap="round"
    vector-effect="non-scaling-stroke"
  />
</svg>

<style>
  .spark {
    width: 100%;
    height: 32px;
    overflow: visible;
    animation: fade 0.7s var(--ease-standard) both;
  }
  @keyframes fade {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .spark {
      animation: none;
    }
  }
</style>
