/** Shared domain types. Content (SignDefinition) is immutable and shipped;
 *  ReviewState is mutable per-user state persisted to localStorage. They join by id. */

export type SignCategory =
  | 'prohibitory' // round, red ring — "you must not"
  | 'mandatory' // round, blue — "you must"
  | 'warning' // triangle, red border
  | 'direction' // rectangle (non-motorway routes)
  | 'information' // rectangle, blue/white
  | 'roadworks' // temporary
  | 'marking' // road markings (drawn in-app)
  | 'signal' // light signals (drawn in-app)
  | 'motorway' // blue motorway signs + gantry signals (opt-in; mostly drawn in-app)

export type SignShape =
  | 'circle'
  | 'triangle'
  | 'inverted-triangle'
  | 'octagon'
  | 'rectangle'
  | 'diamond'

export type Tier = 'core' | 'standard' | 'edge'

export interface SignDefinition {
  /** stable kebab-case slug; used by stats + confusedWith */
  id: string
  /** the answer a learner must produce */
  caption: string
  category: SignCategory
  subcategory?: string
  tier: Tier
  /** edge signs default false (toggle on in Settings) */
  enabled: boolean
  shape: SignShape
  /** short human description of the sign's appearance */
  colour: string
  /** bundled SVG filename, or '' when composite (drawn in-app) */
  asset: string
  /** true => rendered by an in-app drawing, not a single SVG */
  composite?: boolean
  /** TSRGD diagram number */
  diagram?: string
  /** 1–2 sentences: the real-world meaning and required action */
  explanation: string
  mnemonic?: string
  /** ids of look-alike signs */
  confusedWith: string[]
  /** layman phrases for the reference search */
  searchTerms: string[]
  /** OGL source: the Wikimedia Commons File: page for the official artwork
   *  (absent for composites, which are drawn in-app) */
  source?: string
}

/** 0 Again · 1 Hard · 2 Good · 3 Easy */
export type Grade = 0 | 1 | 2 | 3

export interface ReviewEvent {
  t: number
  grade: Grade
  intervalDays: number
}

export interface ReviewState {
  id: string
  ease: number // SM-2 EF, starts 2.5, floor 1.3
  intervalDays: number
  reps: number // consecutive correct
  lapses: number
  dueAt: number // epoch ms
  lastReviewedAt: number | null
  introduced: boolean
  timesSeen: number
  correct: number
  incorrect: number
  streak: number
  bestStreak: number
  avgResponseMs: number
  /** ids of distractors chosen when this card was missed in the quiz */
  confusionLog: string[]
  history: ReviewEvent[] // capped ring buffer
}

export type ThemePref = 'system' | 'light' | 'dark'

/** How wide the study/quiz deck is, by sign tier:
 *  essential = core only · standard = core + standard (default) ·
 *  comprehensive = every non-motorway sign, including edge/specialist. */
export type DeckScope = 'essential' | 'standard' | 'comprehensive'

/** Tiers included at each scope (cumulative). */
export const SCOPE_TIERS: Record<DeckScope, readonly Tier[]> = {
  essential: ['core'],
  standard: ['core', 'standard'],
  comprehensive: ['core', 'standard', 'edge'],
}

export interface Settings {
  newPerDay: number
  /** cap on the number of *due* reviews surfaced in one Study session (new cards
   *  are budgeted separately by newPerDay) — keeps a post-absence backlog from
   *  becoming a fatiguing wall in a single sitting */
  reviewCap: number
  deckScope: DeckScope
  includeMarkings: boolean
  /** include the motorway-signs module (off by default — motorways are beyond CBT
   *  scope; orthogonal to the deck-scope slider) */
  includeMotorway: boolean
  showCategoryHint: boolean
  /** mix new cards across categories instead of introducing them in category order */
  shuffleCategories: boolean
}

export interface SessionRecord {
  date: string // YYYY-MM-DD (local)
  reviewed: number
  correct: number
  newSeen: number
}

export const DEFAULT_SETTINGS: Settings = {
  newPerDay: 12,
  reviewCap: 50,
  deckScope: 'standard',
  includeMarkings: true,
  includeMotorway: false,
  showCategoryHint: true,
  shuffleCategories: false,
}

export const CATEGORY_META: Record<
  SignCategory,
  { label: string; short: string; order: number }
> = {
  prohibitory: { label: 'Prohibitory orders', short: 'Prohibition', order: 0 },
  mandatory: { label: 'Mandatory orders', short: 'Mandatory', order: 1 },
  warning: { label: 'Warning signs', short: 'Warning', order: 2 },
  information: { label: 'Information signs', short: 'Information', order: 3 },
  direction: { label: 'Direction signs', short: 'Direction', order: 4 },
  roadworks: { label: 'Road works', short: 'Road works', order: 5 },
  marking: { label: 'Road markings', short: 'Marking', order: 6 },
  signal: { label: 'Light signals', short: 'Signal', order: 7 },
  motorway: { label: 'Motorway signs', short: 'Motorway', order: 8 },
}
