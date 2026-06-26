<!-- This file is the AGENT PROMPT, fed verbatim to each loop iteration — keep it task-only.
     Operator docs (how to run loop.sh, the plugin, flags, permissions) live in .claude/README.md. -->

# Ralph loop — one issue per run

You are a single iteration of a loop working through this repo's open **GitHub issue** backlog (a UK
motorcycle **CBT road-signs** revision app — Svelte 5 + Vite + TypeScript). Read `CLAUDE.md` first and obey
it. Complete **exactly one** issue this run, end to end, then stop. Assume no memory of prior runs —
discover everything from the live repo.

### 0. Orient (always, from scratch)
- Ensure a clean tree on an up-to-date `main`: if `git status` isn't clean, `git stash` only stray junk you
  clearly didn't create, otherwise stop and report. Then `git switch main && git pull --ff-only`.
- Read `CLAUDE.md` (conventions, the content pipeline, the "keep check/test green" rule).
- List the queue: `gh issue list --state open --json number,title,labels,url`.
- Find issues already in flight so you don't double-work:
  `gh pr list --state open --json number,headRefName,closingIssuesReferences` — collect every issue number
  in `closingIssuesReferences`. Treat those issues as **taken**.

### 1. Select exactly one issue (deterministic)
Among open issues that are **not taken**, pick in this order, lowest issue number first within a tier:
1. label `P1`
2. label `P2`
3. anything else

If there are **no actionable issues** (all taken, or none open), **stop now**: print
`RALPH: backlog drained — nothing to do` **and** `OBJECTIVE_COMPLETE` on its own line, then exit without
changes. Do not invent work. (Both are completion sentinels — a bash runner watches for the first; a plugin
/ external driver watches for the second. Emit both so either stops cleanly.)

Re-read the chosen issue fully (`gh issue view <N>`). If its acceptance criteria are already met in the
current code (it's stale), close it with a short explanatory comment and stop.

### 2. Branch
`git switch -c issue-<N>-<short-slug>` off fresh `main`. If a remote branch `issue-<N>-*` already exists
(a crashed earlier run), check it out and continue it instead of starting over.

### 3. Implement — minimal, scoped, conventional
- Solve **only** issue #N. Don't refactor unrelated code or fold in other issues. Smallest change that
  satisfies the acceptance criteria, matching the surrounding code's style.
- **Honour the content pipeline**: never hand-edit generated files (`src/data/signs.ts`, `CHANGELOG.md`).
  For content changes edit `src/data/_gen/*.json` (and/or `CLUSTERS` in `scripts/build-signs.ts`) then
  `npm run build-signs`. Verify sign appearance against the rendered artwork, never assume from the TSRGD
  number.
- Prefer reusing existing utilities/patterns (the pure modules in `src/lib/`, existing components) over new
  code. Keep the learning-engine modules pure and add/extend unit tests under `tests/` for any logic change.

### 4. Verify — gates must be green
Run and make all pass:
```bash
npm run check          # 0 errors / 0 warnings
npm test               # all unit tests
npm run build          # production build must succeed
DEPLOY_TARGET=gh-pages npm run build   # also the Pages build path
```
Add tests proving the fix where it's testable. **If you cannot get the gates green this iteration, do NOT
open a PR**: push the branch, comment on issue #N with the exact blocker and what you tried, then stop. A
half-working PR is worse than none.

### 5. Versioning / release notes (only when user-facing)
If the change is notable to a user (a feature, a visible fix), per `CLAUDE.md`: prepend an entry to
`src/data/changelog.ts` (newest first), bump `package.json` `version` to match (semver), and run
`npm run build-changelog`. Skip this for pure tests/tooling/internal tech-debt.

### 6. Commit + PR (one issue → one PR)
```bash
git add -A
git commit   # clear message; end with the trailer below
git push -u origin HEAD
gh pr create --fill --base main \
  --title "<concise>" \
  --body "Closes #<N>. <what changed & why, acceptance criteria checked off>"
```
- Commit message MUST end with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- PR body MUST contain `Closes #<N>` (so the issue auto-closes on merge) and MUST end with:
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
- Never commit or push to `main` directly.

### 7. Create new issues — ONLY if genuinely needed
Don't inflate the backlog. Open a new issue **only** when, during this work, you hit one of:
- a **real, out-of-scope bug** you must not silently fix inside this PR;
- the issue is genuinely **too large for one PR** and must be split (file the follow-up slice(s));
- a **true prerequisite** is missing and blocks acceptance.

Before filing, `gh issue list --search "<keywords>"` to avoid duplicates. Use the existing labels
(`accessibility`, `content`, `tech-debt`, `learning-engine`, `enhancement`, `bug`, `documentation`,
`good first issue`, `P1`, `P2`) and reference the originating issue (`Found while working on #<N>`). If
nothing qualifies, create nothing — the common case.

### 8. Finish the iteration
Print a one-line summary: `RALPH: #<N> "<title>" → PR <url> (gates green)`. Stop. Do not start another
issue this run — the loop will re-invoke you.

### Guardrails
- If multi-agent orchestration is available this run (a section enabling it is appended below, or you're in
  an `ultracode` mode), you MAY use the Workflow tool — scoped to the single selected issue, still exactly
  one PR. Otherwise work solo; small/mechanical issues never need it.
- One issue per run; one PR per issue; minimal diff.
- Generated files are outputs — change the generator, not the output.
- Keep `npm run check` and `npm test` green; that's the definition of done.
- Don't touch statutory sign colours/shapes; composites stay flagged as illustrations.
- No analytics, no backend, no new runtime dependencies unless the issue explicitly calls for it.
- If anything is ambiguous or risky beyond the issue's scope, stop and report rather than guessing.
