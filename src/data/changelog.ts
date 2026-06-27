/** Release notes — the single source of truth for the app version + "last
 *  updated" date. Newest release first. `npm run build-changelog` mirrors this
 *  to CHANGELOG.md. Add a new entry (and bump package.json) on every notable
 *  change so the version/date shown in Settings stays meaningful. */
export interface Release {
  version: string
  /** ISO date (YYYY-MM-DD) the release was cut */
  date: string
  changes: string[]
}

export const CHANGELOG: Release[] = [
  {
    version: '1.13.0',
    date: '2026-06-27',
    changes: [
      'New here? A short welcome screen now greets you on first launch — three quick points on how it works (learn a few signs a day, answer “Got it / Missed”, start with the core signs) and a one-tap “Start studying” button — so you’re not dropped onto an empty stats page wondering what to do. It only appears once and never again after you dismiss it.',
    ],
  },
  {
    version: '1.12.1',
    date: '2026-06-27',
    changes: [
      'Fixed the quiz’s “Name the sign / Spot the sign” toggle, which appeared to do nothing: tapping it before answering now switches the current question to that direction straight away (previously the change only took effect on the *next* question, with no on-screen hint, so it looked broken). To avoid giving the answer away, flipping brings in a fresh sign you haven’t seen rather than re-showing the one already on screen. If you flip after answering, a small “Starts on the next question” note now explains the wait.',
    ],
  },
  {
    version: '1.12.0',
    date: '2026-06-27',
    changes: [
      'Get a wrong quiz answer in “Name the sign” mode and you’ll now see the two signs side by side — the one you picked and the correct one — so you can spot exactly how they differ, instead of just reading the right answer’s name. (“Spot the sign” already shows the signs, so it’s unchanged.)',
    ],
  },
  {
    version: '1.11.0',
    date: '2026-06-27',
    changes: [
      'New “Spot the sign” quiz direction. The quiz now has a toggle: “Name the sign” (the classic — see a sign, pick its meaning) or “Spot the sign” (read a meaning, pick the matching sign from four images). Recognising a sign from its meaning is the skill you actually use on the road, and it was never practised before. Both directions reuse the same look-alike-aware question building and feed your schedule identically.',
    ],
  },
  {
    version: '1.10.0',
    date: '2026-06-27',
    changes: [
      'Misgraded a card? A brief “Graded — Undo” button now appears after each answer in Study and Quiz (press U, or tap it). Undo puts the card back exactly as it was — its schedule, your session tally, and the pace it learns your speed from — so a stray tap no longer quietly skews your revision.',
    ],
  },
  {
    version: '1.9.2',
    date: '2026-06-27',
    changes: [
      'Study and Quiz now speak their result aloud to screen readers: after each card you hear whether you got it and the pace it was marked at (e.g. “Correct — marked Good”), and a wrong quiz answer reads out the right one. Previously there was no spoken confirmation at all.',
    ],
  },
  {
    version: '1.9.1',
    date: '2026-06-27',
    changes: [
      'Made the sign-detail and release-notes pop-ups properly keyboard- and screen-reader-friendly. Tab now stays inside the open panel and loops around instead of slipping out to the page behind it, the background is held still and inert while a panel is open, and when you close it your place on the page is restored.',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-06-26',
    changes: [
      'Study sessions now have a daily cap, so coming back after a few days away no longer hands you a wall of 100+ cards at once. By default you’ll see up to 50 due cards a sitting (plus your new ones); the rest wait for your next session, shown as a “+N more today” note rather than vanishing. Tune the cap under Settings → “Max reviews per session”.',
    ],
  },
  {
    version: '1.8.2',
    date: '2026-06-25',
    changes: [
      'Fixed the Study card showing a sign’s category twice when you reveal the answer — “Prohibition” (or whichever category) appeared both above the sign and above its name. It now shows once.',
    ],
  },
  {
    version: '1.8.1',
    date: '2026-06-25',
    changes: [
      'Sharpened the hand-drawn road-marking and signal illustrations so they match the real signs more faithfully. Green primary-route and route-confirmation signs now show their route numbers in yellow; the temporary roadworks speed limit sits on its yellow backing board; and the zebra crossing, red-route, kerb-loading and give-way markings are drawn the way you’ll meet them on the road.',
      'Smaller touch-ups across the rest: a clearer lane-merge arrow, a black-and-white police chequer cap, a single-housing tram signal, a bus-and-cycle lane sign, and tidier motorway boards. The official sign artwork is untouched — only the in-app illustrations were corrected.',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-06-25',
    changes: [
      'A calmer new look. The app now wears warm paper and soft ink, with a single quiet red for emphasis — gentler on the eyes for long study, and friendlier for ADHD, dyslexia and PDA. The road signs are untouched: still the only bright, official thing on the page.',
      'New reading typefaces — an editorial serif for headings, and the highly legible Lexend and Atkinson Hyperlegible for everything you read — with roomier line spacing. Labels are sentence case now, never shouted in capitals.',
      'Gentler motion throughout: things settle into place instead of bouncing, and it still steps out of the way entirely when you’ve asked for reduced motion.',
    ],
  },
  {
    version: '1.7.1',
    date: '2026-06-25',
    changes: [
      'Fixed a blank Quiz screen when you’d finished everything for the day: it now shows a clear “All caught up” message instead of an empty page.',
      'Cleared up the mixed signals when you’re all caught up — the Report and Study no longer nudge you toward a quiz that has nothing to ask; they point you to the Reference to keep browsing instead.',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-06-22',
    changes: [
      'Rebuilt the Report as a coach. It now opens with the one thing to do right now — review what’s due, learn a few new signs, or take a quiz — shows how many core signs you can recall unaided, and lists the handful tripping you up most with a “Drill these” shortcut. The detailed charts (accuracy, learning stages, memory strength, schedule, categories) now live in a tucked-away “Details & progress” section.',
      'Every figure is now honest about how long you’ve actually been revising: it reads “over your 4 days”, never a confusing “30-day” score before you’ve been going 30 days, and a brand-new Report greets you with a clear starting point instead of empty stats. Resetting progress also restarts your “day 1” clock.',
      'New saved signs: tap the star on any sign — in the Reference grid or on its detail card — to bookmark it, then use the “Saved” filter in the Reference to revise just those. Your saved signs are kept when you reset progress and travel with your backup.',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-06-21',
    changes: [
      'Study cards now keep the road sign visible while you grade your recall — the answer expands below the sign instead of flipping it out of view, so you can check your memory against the real artwork.',
      'Often-confused signs are now shown as side-by-side pictures, not just names, so you can compare lookalikes directly.',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-06-21',
    changes: [
      'New “Your learning plan” section in the Report shows what the spaced-repetition system has worked out: a 14-day forecast of when your signs come back, a learning-stage breakdown (New · Learning · Settling · Locked in), and a memory-strength view of how long each sign now sticks.',
      'More accurate “due” counts around the twice-yearly British Summer Time clock change.',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-06-21',
    changes: [
      'New optional Motorway signs module (off by default, since motorways are beyond CBT scope): 10 signs covering start and end of motorway, countdown markers, junction and route-confirmatory signs, services, and smart-motorway gantry signals — variable mandatory speed limits, the red “X” lane closure, amber advisory signals and the “End” of restriction.',
      'Turn it on under Settings → Study → “Include motorway signs”; it’s kept separate from the coverage slider so it never affects your core revision.',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-06-21',
    changes: [
      'Added 17 illustrated road markings & signals (yellow/red lines, cat’s-eye studs, lane arrows, KEEP CLEAR / SLOW, pelican, tram and police-officer signals) — each clearly marked as an in-app illustration, not official artwork.',
      'New “Shuffle across categories” study option that mixes new signs from all families instead of one category at a time.',
      'Fixed the yellow box junction marking to show the correct criss-cross lattice.',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-06-21',
    changes: [
      'Comprehensive sign set: 55 more non-motorway signs behind a new three-stage coverage slider — Essentials · Standard · Comprehensive.',
      'Every sign now links to its official source artwork on Wikimedia Commons (Open Government Licence).',
      'Reviewed and corrected every memory aid against the real sign artwork.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-06-20',
    changes: [
      'Added a link to the source code from Settings.',
      'Optional, privacy-friendly analytics (cookieless, off by default).',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-06-20',
    changes: [
      'Initial release: spaced-repetition study, multiple-choice quiz, searchable reference, performance report, light/dark themes, and offline support.',
    ],
  },
]

export const APP_VERSION = CHANGELOG[0].version
export const LAST_UPDATED = CHANGELOG[0].date
