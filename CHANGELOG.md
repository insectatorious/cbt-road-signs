# Changelog

All notable changes to this project. **Generated** from `src/data/changelog.ts`
(the in-app release notes) — edit that and run `npm run build-changelog`.

## 1.7.1 — 25 June 2026

- Fixed a blank Quiz screen when you’d finished everything for the day: it now shows a clear “All caught up” message instead of an empty page.
- Cleared up the mixed signals when you’re all caught up — the Report and Study no longer nudge you toward a quiz that has nothing to ask; they point you to the Reference to keep browsing instead.

## 1.7.0 — 22 June 2026

- Rebuilt the Report as a coach. It now opens with the one thing to do right now — review what’s due, learn a few new signs, or take a quiz — shows how many core signs you can recall unaided, and lists the handful tripping you up most with a “Drill these” shortcut. The detailed charts (accuracy, learning stages, memory strength, schedule, categories) now live in a tucked-away “Details & progress” section.
- Every figure is now honest about how long you’ve actually been revising: it reads “over your 4 days”, never a confusing “30-day” score before you’ve been going 30 days, and a brand-new Report greets you with a clear starting point instead of empty stats. Resetting progress also restarts your “day 1” clock.
- New saved signs: tap the star on any sign — in the Reference grid or on its detail card — to bookmark it, then use the “Saved” filter in the Reference to revise just those. Your saved signs are kept when you reset progress and travel with your backup.

## 1.6.0 — 21 June 2026

- Study cards now keep the road sign visible while you grade your recall — the answer expands below the sign instead of flipping it out of view, so you can check your memory against the real artwork.
- Often-confused signs are now shown as side-by-side pictures, not just names, so you can compare lookalikes directly.

## 1.5.0 — 21 June 2026

- New “Your learning plan” section in the Report shows what the spaced-repetition system has worked out: a 14-day forecast of when your signs come back, a learning-stage breakdown (New · Learning · Settling · Locked in), and a memory-strength view of how long each sign now sticks.
- More accurate “due” counts around the twice-yearly British Summer Time clock change.

## 1.4.0 — 21 June 2026

- New optional Motorway signs module (off by default, since motorways are beyond CBT scope): 10 signs covering start and end of motorway, countdown markers, junction and route-confirmatory signs, services, and smart-motorway gantry signals — variable mandatory speed limits, the red “X” lane closure, amber advisory signals and the “End” of restriction.
- Turn it on under Settings → Study → “Include motorway signs”; it’s kept separate from the coverage slider so it never affects your core revision.

## 1.3.0 — 21 June 2026

- Added 17 illustrated road markings & signals (yellow/red lines, cat’s-eye studs, lane arrows, KEEP CLEAR / SLOW, pelican, tram and police-officer signals) — each clearly marked as an in-app illustration, not official artwork.
- New “Shuffle across categories” study option that mixes new signs from all families instead of one category at a time.
- Fixed the yellow box junction marking to show the correct criss-cross lattice.

## 1.2.0 — 21 June 2026

- Comprehensive sign set: 55 more non-motorway signs behind a new three-stage coverage slider — Essentials · Standard · Comprehensive.
- Every sign now links to its official source artwork on Wikimedia Commons (Open Government Licence).
- Reviewed and corrected every memory aid against the real sign artwork.

## 1.1.0 — 20 June 2026

- Added a link to the source code from Settings.
- Optional, privacy-friendly analytics (cookieless, off by default).

## 1.0.0 — 20 June 2026

- Initial release: spaced-repetition study, multiple-choice quiz, searchable reference, performance report, light/dark themes, and offline support.
