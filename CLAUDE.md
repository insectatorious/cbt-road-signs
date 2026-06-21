# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

A static, client-only **UK motorcycle CBT road-signs revision app** (Svelte 5 + Vite + TypeScript, GSAP for motion). No backend, no tracking; all state in `localStorage`. Motorway signs are intentionally out of scope (kept in data behind `excludeFromV1`).

## Commands

```bash
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # production build → dist/  (root base "/")
npm run preview      # serve the production build (port 4173)
npm run check        # svelte-check (types) — keep at 0 errors/0 warnings
npm test             # vitest (pure-logic units: scheduler/stats/quiz)
npx vitest run tests/scheduler.test.ts      # a single test file
npx vitest run -t "ease never drops"        # a single test by name
DEPLOY_TARGET=gh-pages npm run build        # GitHub Pages build (base "/<repo-name>/")
```

Content/asset regeneration (rarely needed — see data pipeline below):
```bash
npm run build-signs     # regenerate src/data/signs.ts from src/data/_gen/*.json
npm run fetch-assets    # download OGL sign SVGs from Wikimedia → src/assets/signs/
npm run resolve-assets  # repair filenames fetch-assets 404'd (uses the Commons API)
npm run gen-icons       # PWA icons → public/icons/ (needs sharp)
npm run build-changelog # regenerate CHANGELOG.md from src/data/changelog.ts
```

## Architecture

### The content pipeline (most important to understand)
- **`src/data/signs.ts` is AUTO-GENERATED — never edit it by hand.** It is produced by `scripts/build-signs.ts` from `src/data/_gen/*.json` (one file per category, the editorial source). The generator strips build-only fields, sets `enabled = tier !== 'edge'`, and wires each sign's `confusedWith[]` from the **`CLUSTERS` map defined in `build-signs.ts`** (not in the data). To change content: edit `_gen/*.json` (and/or `CLUSTERS`), then `npm run build-signs`.
- **Sign artwork**: ~99 official SVGs live in `src/assets/signs/` (Crown copyright, OGL — see that dir's `ATTRIBUTION.md`). `fetch-assets.ts` downloads them by the verified filename in `_gen`; `resolve-assets.ts` exists as a second pass because Wikimedia rate-limits (429) and some TSRGD numbers map to non-obvious filenames (e.g. `UK traffic sign 504.1 (variant 1).svg`). The app **never** hits Wikimedia at runtime — all assets are bundled.
- **Rendering a sign** (`components/SignPlate.svelte`): resolves the bundled SVG via `import.meta.glob`; `composite` signs (road markings, traffic-light/pedestrian signals, worded direction panels) are drawn in-app by `SignComposite.svelte`; anything missing falls back to a generated `SignPlaceholder.svelte`. **A new composite id must either get a hand-coded branch in `SignComposite.svelte` or an entry in `src/lib/compositeArt.ts`** (a data map of `{viewBox, inner}` SVG markup rendered via `{@html}`) — otherwise it renders the "?" fallback. Composites are flagged in the UI as illustrations (a plate tag + a `SignDetail` disclaimer) since they're drawn, not official OGL artwork.

### State & the learning engine
- **`src/lib/types.ts`** defines the core split: `SignDefinition` (immutable, shipped) vs `ReviewState` (mutable, persisted), joined by `id`. Nothing else duplicates this.
- **`src/lib/store.svelte.ts`** is the single source of truth — a Svelte 5 `$state` rune object holding `reviews`/`settings`/`sessions`. It owns all mutations (`gradeSign`, `gradeQuiz`, settings, reset, export/import), prunes orphan reviews on load, and persists **debounced + flushed on `pagehide`/`visibilitychange`** (mobile-safe). `quizFocus` is a one-shot id list the Report sets for "Drill these".
- **Pure, framework-agnostic, unit-tested modules** (import these for logic; they have no DOM/window deps):
  - `scheduler.ts` — SM-2-lite. 4 grades → SM-2 q. `grade()` is pure (never mutates input); Easy graduates a new card to 4 days.
  - `pace.ts` — adaptive, time-inferred grading. The user only supplies **correctness** (Study: "Got it / Missed" = `RecallBar`; Quiz: right/wrong); the Hard/Good/Easy *shade* of a correct answer is inferred from recall speed **relative to that user's own EMA baseline** (`studyPaceMs`/`quizPaceMs`, kept separate per mode, persisted in `meta`). `store.gradeRecall` (time-to-flip) and `store.gradeQuiz` (time-to-select) own this; `Study.svelte` measures `shownAt → reveal`.
  - `deck.ts` — `activeDeck()` (the in-scope filter: `!excludeFromV1`, tier gated by the **`deckScope`** slider via `SCOPE_TIERS` — essential/standard/comprehensive — markings by `includeMarkings`) and `buildStudyQueue()` (due reviews interleaved with new cards; `shuffleNew` mixes new cards across categories instead of importance order). Settings migrate the legacy `includeEdge` boolean → `deckScope`.
  - `stats.ts` — `struggleScore`, `isMastered`, `buildReport`, `rankCards` (best/worst lists are kept disjoint).
  - `quiz.ts` — distractors come from `confusedWith` first, then same category, then random.
  - `search.ts` — dependency-free ranked substring + fuzzy.
- **`activeDeck()` vs the full set**: Study and Quiz use `activeSigns()` (respects settings); the Reference (`Browse.svelte`) deliberately shows the *complete* set minus motorway.

### Views, routing, theme, motion
- **Hash router** (`router.svelte.ts`): routes are `study|quiz|browse|report|settings`. `App.svelte` swaps the active view with `{#key route}`. Hash routing means static hosts need **no rewrite rules**.
- **Theme** is separate from app state: `theme.svelte.ts` stores the preference under `localStorage['cbt-theme']` and applies `data-theme` on `<html>`; the **no-flash bootstrap inline script in `index.html`** sets it before first paint. Tokens for both themes live in `src/styles/tokens.css`; shared utilities/buttons in `base.css`.
- **All GSAP is in `src/lib/motion.ts`**, behind one `prefersReduced()` guard (plus a global reduced-motion CSS rule in `base.css`). **Gotcha:** grade "exit" animations run their `onDone`/`advance` callback in GSAP's `onComplete` (async, ~220ms). `Study.svelte` therefore needs its `grading` re-entrancy flag — without it, key auto-repeat double-grades the card and skips the next one. Any new animated advance/exit needs the same synchronous in-flight guard.

### Deploy
GitHub Pages via Actions: `.github/workflows/deploy.yml` (Node 22) builds with `DEPLOY_TARGET=gh-pages` and deploys on every push to `main`. `vite.config.ts` derives the Pages `base` from `GITHUB_REPOSITORY` (rename-proof); local dev/preview use `/`. PWA (offline) is generated by `vite-plugin-pwa`.

### Versioning & release notes
`src/data/changelog.ts` is the **single source of truth** for the app version, the "last updated" date, and the in-app release notes (shown in Settings → About, opened as the `ReleaseNotes` modal). On every notable change: prepend a `{version, date, changes[]}` entry (semver, newest first), bump `package.json` `version` to match, and run `npm run build-changelog` to regenerate the GitHub-facing `CHANGELOG.md`. `APP_VERSION`/`LAST_UPDATED` are derived from the top entry.

## Conventions
- Keep `npm run check` and `npm test` green before considering a change done.
- Generated/derived files (`src/data/signs.ts`, `src/data/_gen/asset-manifest.json`, `CHANGELOG.md`, `dist/`, `public/icons/`) are outputs — change the generator, not the output.
- `scripts/` are dev-time tooling and are deliberately excluded from `tsconfig.json`/`svelte-check`.
