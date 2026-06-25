/** Render-based guard for the in-app illustrated (composite) signs.
 *
 *  The composites are drawn in `SignComposite.svelte` (hand-coded branches) and
 *  `src/lib/compositeArt.ts` (the COMPOSITE_ART data map). Nothing else in the
 *  suite renders a pixel, so artwork defects / unwired ids can drift in silently
 *  (see issues #5, #13, #14). This file closes that gap three ways:
 *
 *   1. Resolution — every `composite: true` sign renders real art and never the
 *      "?" fallback (the "new composite id with no art" footgun in CLAUDE.md).
 *   2. Well-formedness — every COMPOSITE_ART entry is wired to a real sign and
 *      rasterises as valid SVG (sharp throws on malformed markup).
 *   3. Regression net — a committed snapshot of each composite's rendered art,
 *      so any geometry/colour/text change must be eyeballed and re-blessed
 *      (`vitest -u`).
 *
 *  Deterministic by construction: composites are static declarative SVG, and we
 *  snapshot the (normalised) markup rather than rasterised pixels, sidestepping
 *  cross-machine font rendering. */
import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { render } from 'svelte/server'
import SignComposite from '../src/components/SignComposite.svelte'
import { signs } from '../src/data/signs'
import { COMPOSITE_ART } from '../src/lib/compositeArt'
import type { SignDefinition } from '../src/lib/types'

const compositeSigns = signs.filter((s) => s.composite)
const signById = new Map(signs.map((s) => [s.id, s]))

/** Render a sign through the real SignComposite resolution path
 *  (hand-coded branch → category branch → COMPOSITE_ART → "?" fallback). */
function renderComposite(sign: SignDefinition): string {
  const out = render(SignComposite, { props: { sign } }) as { body?: string; html?: string }
  return out.body ?? out.html ?? ''
}

/** Strip Svelte's hydration comment markers and the scoped style-class token so
 *  the snapshot tracks the ART, not Svelte internals or unrelated style churn. */
function normaliseArt(markup: string): string {
  return markup
    .replace(/<!--[\s\S]*?-->/g, '') // svelte markers + decorative svg comments
    .replace(/ svelte-[a-z0-9]+/g, '') // scoped style class token
    .trim()
}

const standaloneSvg = (viewBox: string, inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${inner}</svg>`

describe('every composite sign resolves to real art', () => {
  it('there are composite signs to guard', () => {
    expect(compositeSigns.length).toBeGreaterThan(0)
  })

  it.each(compositeSigns.map((s) => [s.id, s] as const))(
    '%s renders real art, not the "?" fallback',
    (_id, sign) => {
      const markup = renderComposite(sign)
      expect(markup).toContain('<svg')
      expect(markup).not.toContain('data-fallback')
    },
  )

  it('the guard is live: an unwired composite id hits the "?" fallback', () => {
    // Negative control — proves the assertion above can actually fail.
    const orphan: SignDefinition = {
      ...compositeSigns[0],
      id: '__no-such-composite-art__',
      category: 'warning',
    }
    expect(renderComposite(orphan)).toContain('data-fallback')
  })
})

describe('COMPOSITE_ART entries are well-formed and wired', () => {
  it.each(Object.keys(COMPOSITE_ART))('%s maps to a real composite sign', (id) => {
    const sign = signById.get(id)
    expect(sign, `COMPOSITE_ART['${id}'] has no matching sign`).toBeDefined()
    expect(sign!.composite).toBe(true)
  })

  it.each(Object.entries(COMPOSITE_ART))('%s has a 4-number viewBox and non-empty inner', (_id, art) => {
    const nums = art.viewBox.trim().split(/\s+/).map(Number)
    expect(nums).toHaveLength(4)
    expect(nums.every((n) => Number.isFinite(n))).toBe(true)
    expect(art.inner.trim().length).toBeGreaterThan(0)
  })

  it.each(Object.entries(COMPOSITE_ART))('%s rasterises as valid, correctly-sized SVG', async (_id, art) => {
    const [, , vbW, vbH] = art.viewBox.trim().split(/\s+/).map(Number)
    const svg = Buffer.from(standaloneSvg(art.viewBox, art.inner))
    // sharp throws on malformed SVG; metadata reports the intrinsic size librsvg
    // derived from the viewBox — a real signal that it parsed, not a magic byte count.
    const meta = await sharp(svg).metadata()
    expect(meta.format).toBe('svg')
    expect(meta.width).toBe(Math.round(vbW))
    expect(meta.height).toBe(Math.round(vbH))
    // …and it fully rasterises without error.
    await sharp(svg).png().toBuffer()
  })
})

describe('composite art is stable', () => {
  it('matches the committed art baselines', () => {
    const baseline: Record<string, string> = {}
    for (const sign of [...compositeSigns].sort((a, b) => a.id.localeCompare(b.id))) {
      baseline[sign.id] = normaliseArt(renderComposite(sign))
    }
    expect(baseline).toMatchSnapshot()
  })
})
