/**
 * Synthesises src/data/signs.ts from the per-category files in src/data/_gen.
 * Strips build-only fields, sets `enabled`, wires confusion clusters, and
 * orders the deck. Run: npm run build-signs
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'

const GEN_DIR = new URL('../src/data/_gen/', import.meta.url)
const OUT = new URL('../src/data/signs.ts', import.meta.url)

const CATEGORY_ORDER: Record<string, number> = {
  prohibitory: 0,
  mandatory: 1,
  warning: 2,
  information: 3,
  direction: 4,
  roadworks: 5,
  marking: 6,
  signal: 7,
}
const TIER_RANK: Record<string, number> = { core: 0, standard: 1, edge: 2 }

/** Bidirectional look-alike groups (the heart of "commonly confused with"). */
const CLUSTERS: string[][] = [
  ['no-entry', 'no-motor-vehicles', 'no-vehicles'],
  ['stop-and-give-way', 'give-way'],
  ['maximum-speed-limit', 'national-speed-limit', 'minimum-speed'],
  ['no-left-turn', 'turn-left-ahead', 'turn-left-at-junction', 'keep-left'],
  ['no-right-turn', 'turn-right-ahead', 'keep-right'],
  ['ahead-only', 'keep-left', 'keep-right', 'pass-either-side'],
  ['mini-roundabout', 'roundabout'],
  ['no-stopping-clearway', 'no-waiting'],
  ['two-way-traffic', 'one-way-traffic', 'two-way-traffic-crosses-a-one-way-road'],
  ['crossroads', 't-junction', 'staggered-junction', 'junction-priority-over-minor-road'],
  ['bend-to-the-right', 'double-bend-first-to-the-left'],
  ['road-narrows-on-both-sides', 'road-narrows-on-the-right', 'road-narrows-on-the-left'],
  [
    'level-crossing-with-barrier-or-gate-ahead',
    'level-crossing-without-barrier-or-gate-ahead',
    'trams-crossing-ahead',
  ],
  ['distance-to-give-way-line-ahead', 'distance-to-stop-line-ahead'],
  ['maximum-height', 'maximum-width', 'maximum-length', 'maximum-gross-weight'],
  [
    'children',
    'school-crossing-patrol-ahead',
    'pedestrians-in-road-ahead',
    'frail-or-disabled-pedestrians',
    'zebra-crossing-ahead',
  ],
  ['cattle', 'wild-animals', 'accompanied-horses-or-ponies'],
  ['slippery-road', 'risk-of-ice'],
  ['steep-hill-downwards', 'steep-hill-upwards'],
  ['no-cycling', 'route-for-pedal-cycles-only', 'cycle-route-ahead'],
  ['parking', 'parking-solo-motorcycles', 'parking-restricted-to-permit-holders'],
  ['tunnel-ahead', 'opening-or-swing-bridge-ahead', 'hump-bridge'],
  ['give-way', 'give-priority-to-oncoming-vehicles'],

  // --- extended (edge-tier) signs: look-alike groups for the comprehensive set ---
  ['no-solo-motorcycles', 'no-motor-vehicles-except-solo-motorcycles', 'no-motor-vehicles', 'no-vehicles'],
  ['no-horse-drawn-vehicles', 'no-ridden-or-accompanied-horses', 'accompanied-horses-or-ponies'],
  ['no-articulated-vehicles', 'no-goods-vehicles-over-weight', 'no-towed-caravans', 'no-buses'],
  ['no-buses', 'no-motor-vehicles', 'buses-and-cycles-only'],
  ['no-explosives', 'no-dangerous-goods-tunnel', 'no-articulated-vehicles'],
  ['no-loading-at-any-time', 'no-waiting', 'no-stopping-clearway'],
  ['all-vehicles-prohibited', 'no-vehicles', 'no-motor-vehicles', 'no-entry'],
  ['turn-right-at-junction', 'turn-left-at-junction', 'turn-right-ahead', 'turn-left-ahead'],
  ['buses-and-trams-only', 'buses-and-cycles-only', 'trams-only'],
  ['shared-horse-cycle-pedestrian-route', 'shared-cycle-and-pedestrian-route', 'segregated-pedal-cycle-and-pedestrian-route'],
  ['with-flow-cycle-lane', 'with-flow-cycle-lane-ahead', 'with-flow-bus-lane', 'contra-flow-bus-lane'],
  ['cycle-route-direction-junction', 'national-cycle-route-number', 'regional-cycle-route-number'],
  ['pedestrian-route-direction', 'pedestrian-and-cycle-route-to-station'],
  ['county-boundary', 'non-primary-route-direction-sign', 'primary-route-direction-sign'],
  ['park-and-ride-direction', 'park-and-ride', 'parking'],
  ['sheep', 'cattle', 'wild-animals', 'accompanied-horses-or-ponies'],
  ['migratory-toad-crossing', 'wild-fowl', 'wild-animals'],
  ['agricultural-vehicles', 'wild-animals', 'cattle'],
  ['ford', 'road-liable-to-flooding', 'quayside-or-river-bank'],
  ['try-your-brakes', 'ford', 'steep-hill-downwards'],
  ['soft-verges', 'uneven-road'],
  ['hidden-dip', 'road-humps-ahead', 'uneven-road'],
  ['cattle-grid', 'sheep', 'cattle'],
  ['area-infected-by-animal-disease', 'cattle', 'sheep'],
  ['bend-to-the-left', 'bend-to-the-right', 'double-bend-first-to-the-left'],
  ['sharp-deviation-of-route-left', 'sharp-deviation-of-route-right'],
  ['junction-priority-over-minor-road', 'staggered-junction-side-road-left-first', 'staggered-junction'],
  ['junction-on-a-bend', 'crossroads-on-a-bend', 'bend-to-the-right', 'bend-to-the-left'],
  ['traffic-merges-from-left', 'traffic-merges-onto-main-carriageway'],
  ['junction-on-a-bend', 'crossroads', 'crossroads-on-a-bend', 't-junction'],
  ['level-crossing-countdown-marker', 'level-crossing-with-barrier-or-gate-ahead', 'level-crossing-without-barrier-or-gate-ahead', 'trams-crossing-ahead'],
  ['priority-over-oncoming-vehicles', 'give-priority-to-oncoming-vehicles'],
  ['no-through-road-from-junction', 'no-through-road'],
  ['recommended-cycle-route', 'cycle-route-ahead', 'route-for-pedal-cycles-only'],
  ['bus-stop', 'with-flow-bus-lane', 'contra-flow-bus-lane'],
  ['camping-and-caravan-site', 'picnic-site', 'tourist-attraction-sign', 'tourist-information-point'],
  ['pedestrian-zone', 'home-zone-entry'],
  ['speed-camera-area', 'maximum-speed-limit'],
  ['temporary-traffic-signals', 'traffic-signals-ahead', 'stop-go-board'],
  ['temporary-road-layout-sharp-bends', 'diversion-route', 'ramp-roadworks'],
  ['construction-traffic-direction', 'slow-moving-works-traffic-crossing'],

  // --- composite road markings & signals (in-app illustrations) ---
  ['centre-line-ordinary', 'lane-line', 'hazard-warning-line', 'double-white-lines-solid-your-side'],
  ['edge-of-carriageway-line', 'centre-line-ordinary'],
  ['stop-line-at-signals', 'give-way-markings-at-junction'],
  ['single-double-yellow-lines', 'kerb-loading-markings', 'red-route-markings'],
  ['keep-clear-marking', 'slow-marking'],
  ['bus-lane-marking', 'cycle-lane-marking'],
  ['chevron-hatched-markings', 'yellow-box-junction'],
  ['zig-zag-lines-pedestrian-crossing', 'pelican-crossing-signals'],
  ['pelican-crossing-signals', 'traffic-light-sequence', 'green-filter-arrow'],
  ['tram-driver-signals', 'trams-crossing-ahead', 'trams-only'],
  ['police-officer-traffic-signals', 'traffic-light-sequence'],
]

interface Raw {
  id: string
  caption: string
  category: string
  tier: string
  shape: string
  colour: string
  diagram?: string
  asset?: string
  composite?: boolean
  explanation: string
  mnemonic?: string
  searchTerms?: string[]
  sourceUrl?: string
}

const raw: Raw[] = []
for (const f of readdirSync(GEN_DIR).sort()) {
  if (!f.endsWith('.json')) continue
  const arr = JSON.parse(readFileSync(new URL(f, GEN_DIR), 'utf8')) as Raw[]
  raw.push(...arr)
}

const ids = new Set(raw.map((s) => s.id))

// build confusedWith map from clusters (only ids that exist), capped at 4
const confused = new Map<string, string[]>()
for (const group of CLUSTERS) {
  const present = group.filter((id) => ids.has(id))
  for (const id of present) {
    const list = confused.get(id) ?? []
    for (const other of present) if (other !== id && !list.includes(other)) list.push(other)
    confused.set(id, list)
  }
}

// warn about any cluster ids that don't exist (typos)
for (const group of CLUSTERS) {
  for (const id of group) if (!ids.has(id)) console.warn(`⚠ cluster references unknown id: ${id}`)
}

raw.sort(
  (a, b) =>
    (CATEGORY_ORDER[a.category] ?? 9) - (CATEGORY_ORDER[b.category] ?? 9) ||
    (TIER_RANK[a.tier] ?? 9) - (TIER_RANK[b.tier] ?? 9) ||
    a.caption.localeCompare(b.caption),
)

const clean = raw.map((s) => {
  const o: Record<string, unknown> = {
    id: s.id,
    caption: s.caption,
    category: s.category,
    tier: s.tier,
    enabled: s.tier !== 'edge',
    shape: s.shape,
    colour: s.colour,
    asset: s.composite ? '' : s.asset ?? '',
  }
  if (s.composite) o.composite = true
  if (s.diagram) o.diagram = s.diagram
  o.explanation = s.explanation
  if (s.mnemonic) o.mnemonic = s.mnemonic
  o.confusedWith = (confused.get(s.id) ?? []).slice(0, 4)
  o.searchTerms = s.searchTerms ?? []
  // keep the OGL source link (Wikimedia Commons File: page) so the UI can
  // credit/cite each sign; composites have no single-file source
  if (s.sourceUrl) o.source = s.sourceUrl
  return o
})

const header = `import type { SignDefinition } from '../lib/types'

/* AUTO-GENERATED by scripts/build-signs.ts from src/data/_gen/*.json.
 * Do not edit by hand — edit the generators / _gen sources and re-run
 * \`npm run build-signs\`. ${clean.length} signs. */

export const signs: SignDefinition[] = `

writeFileSync(OUT, header + JSON.stringify(clean, null, 2) + '\n')

const enabled = clean.filter((s) => s.enabled).length
const composite = clean.filter((s) => s.composite).length
console.log(
  `Wrote ${clean.length} signs (${enabled} enabled by default, ${clean.length - enabled} edge, ${composite} composite) → src/data/signs.ts`,
)
