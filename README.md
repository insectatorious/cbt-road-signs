# Road Signs — CBT Revision

A focused, beautiful, offline-capable web app for **spaced-repetition revision of
the UK motorcycle CBT road signs**. Built around the official Highway Code sign set
(motorway content excluded for now), with a Dieter-Rams-inspired design system.

- **Study** — self-graded spaced-repetition flashcards (SM-2-lite).
- **Quiz** — auto-graded multiple choice; distractors are drawn from genuine
  look-alike signs.
- **Reference** — searchable, filterable index of every sign.
- **Report** — recall accuracy, retention, mastery, per-category breakdown, and
  your best- and worst-performing signs (with a one-tap "drill these").
- First-class **dark mode**, full keyboard control, and a **PWA** for offline study.

Everything runs client-side; progress is stored in `localStorage` (export/import in
Settings). No backend, no accounts, no tracking.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (scheduler / stats / quiz)
npm run check      # svelte-check / types
npm run build      # production build → dist/
npm run preview    # serve the production build
```

## Content & assets (regenerate)

```bash
npm run build-signs     # rebuild src/data/signs.ts from src/data/_gen/*.json
npm run fetch-assets    # download OGL sign SVGs from Wikimedia → src/assets/signs/
npm run resolve-assets  # repair any filenames fetch-assets couldn't find
npm run gen-icons       # regenerate PWA icons → public/icons/
```

## Deploy

Deploy-ready for **both** targets:

- **GitHub Pages** — push to `main`; `.github/workflows/deploy.yml` builds with
  `DEPLOY_TARGET=gh-pages` (base path `/cbt-flashcards/`) and publishes via Pages.
- **Netlify** — connect the repo; `netlify.toml` builds to `dist/` from root.

## Attribution

Sign artwork is Crown copyright, reproduced from Wikimedia Commons under the
**Open Government Licence v3.0**. See `src/assets/signs/ATTRIBUTION.md`. App code is
MIT licensed (see `LICENSE`).
