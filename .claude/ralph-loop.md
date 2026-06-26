# Ralph loop — work through the issue backlog

A self-contained, **stateless** prompt. Run it repeatedly (a "Ralph" loop): each run a fresh agent
re-orients from the live repo state, completes **exactly one issue**, opens a PR, and stops. Re-running
makes continuous progress; it converges and stops on its own when there is nothing left to do.

## How to run

**Recommended — the runner (`.claude/loop.sh`):** it drives this prompt, streams output, and stops itself
when the backlog drains. `./.claude/loop.sh --help` for everything; the common forms:
```bash
./.claude/loop.sh --once                              # next single issue, then stop (great first run)
./.claude/loop.sh --workflows --auto-merge --unattended   # full auto, NO permission bypass
./.claude/loop.sh --workflows --auto-merge --unattended -n 5  # ...capped at 5 issues
./.claude/loop.sh --dry-run                           # preview the assembled prompt + claude command
```
Flags: `-n/--max N` (cap iterations), `-s/--sleep SEC`, `--once`, `--workflows`, `--auto-merge`,
`--unattended` (hands-off via `--permission-mode acceptEdits` — auto-applies edits and relies on your
configured tool allowlist; does **not** bypass permissions), `--yolo` (the stronger full bypass — only if
you accept that), `--dry-run`, and `-- <extra claude flags>` (e.g. `-- --model opus`). The runner stops on
the `RALPH: backlog drained` sentinel, a non-zero exit, or `--max`.

> An `--unattended` run only proceeds for tool calls your settings already permit; anything outside your
> allowlist will pause (or, when fully headless, be declined). Either pre-approve the commands the loop uses
> in your Claude settings, or run it where you can approve prompts.

**Manual external loop (no runner):**
```bash
while :; do claude -p "$(cat .claude/ralph-loop.md)" || break; sleep 5; done
```

**With a `ralph-loop` plugin / external driver** (re-feeds the prompt, stops on a completion token):
```
/ralph-loop:ralph-loop "ultracode $(cat .claude/ralph-loop.md)" --completion-promise OBJECTIVE_COMPLETE --max-iterations 20
```
- `ultracode` prefix → multi-agent orchestration on (same intent as `--workflows`).
- `--completion-promise OBJECTIVE_COMPLETE` matches the token this prompt prints at step 1 when the backlog
  is drained.
- `--max-iterations` should comfortably exceed the open-issue count (a blocked/resumed issue can take >1).
- The work queue stays **GitHub issues** (this prompt's protocol) — no separate backlog file is involved.

**Claude Code `/loop`:** run `/loop` and point it at this file, or `/loop` self-paced. Each tick re-runs the
task below.

**Modes (set by the runner flags; the corresponding section is appended to this prompt when enabled):**
- **Workflows** (`--workflows`): you MAY use the Workflow tool to orchestrate subagents on a large or
  cross-cutting issue — still scoped to the one selected issue, still one PR. Off → work solo.
- **Auto-merge** (`--auto-merge`): enable PR auto-merge after CI passes. Off (default) → merging is left to
  the human; the loop just opens PRs that CI gates.

---

## Your task (this is the prompt the agent executes each iteration)

You are working through the open issue backlog of this repo (UK motorcycle **CBT road-signs** revision app —
Svelte 5 + Vite + TypeScript; read `CLAUDE.md` first, every iteration, and obey it). Do **one** issue this
run, end to end, then stop. Assume no memory of prior runs — discover everything from the repo.

### 0. Orient (always, from scratch)
- `git status` must be clean and on an up-to-date `main`. If not: `git stash` stray junk you didn't create
  only if clearly safe, otherwise stop and report. Then `git switch main && git pull --ff-only`.
- Read `CLAUDE.md` (conventions, the content pipeline, the "keep check/test green" rule).
- List the queue: `gh issue list --state open --json number,title,labels,url`.
- Find issues already being handled so you don't double-work:
  `gh pr list --state open --json number,headRefName,closingIssuesReferences` — collect every issue number
  in `closingIssuesReferences`. Treat those issues as **taken**.

### 1. Select exactly one issue (deterministic)
Among open issues that are **not taken**, pick in this order, lowest issue number first within a tier:
1. label `P1`
2. label `P2`
3. anything else

If there are **no actionable issues** (all taken, or none open), **stop now**: print
`RALPH: backlog drained — nothing to do` **and** `OBJECTIVE_COMPLETE` on its own line, then exit without
changes. Do not invent work. (Both are completion sentinels — `loop.sh` watches for the first; a plugin /
external driver watches for the second. Emit both so either runner stops cleanly.)

Re-read the chosen issue fully: `gh issue view <N>`. If its acceptance criteria are already met in the
current code (it's stale), close it with a short explanatory comment and stop.

### 2. Branch
`git switch -c issue-<N>-<short-slug>` off fresh `main`. If a remote branch `issue-<N>-*` already exists
(a crashed earlier run), check it out and continue it instead of starting over.

### 3. Implement — minimal, scoped, conventional
- Solve **only** issue #N. Do not refactor unrelated code or fold in other issues. Smallest change that
  satisfies the acceptance criteria, matching the surrounding code's style.
- **Honour the content pipeline**: never hand-edit generated files (`src/data/signs.ts`, `CHANGELOG.md`).
  For content changes edit `src/data/_gen/*.json` (and/or `CLUSTERS` in `scripts/build-signs.ts`) then
  `npm run build-signs`. Verify sign appearance against the rendered artwork, never assume from the TSRGD
  number.
- Prefer reusing existing utilities/patterns (the pure modules in `src/lib/`, existing components) over new
  code. Keep the learning engine modules pure and add/extend unit tests under `tests/` for any logic change.

### 4. Verify — gates must be green
Run and make all pass:
```bash
npm run check          # 0 errors / 0 warnings
npm test               # all unit tests
npm run build          # production build must succeed
DEPLOY_TARGET=gh-pages npm run build   # also the Pages build path
```
Add tests proving the fix where it's testable. **If you cannot get the gates green within this iteration,
do NOT open a PR**: push the branch, comment on issue #N with the exact blocker and what you tried, then
stop. A half-working PR is worse than none.

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
- PR body MUST end with:
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
- The PR body must contain `Closes #<N>` so the issue links and auto-closes on merge.
- Never commit or push to `main` directly.
- *(Optional autonomy)* to let it land without review once CI is green:
  `gh pr merge --auto --squash` after creating the PR.

### 7. Create new issues — ONLY if genuinely needed
Do **not** inflate the backlog. Open a new issue **only** when, during this work, you hit one of:
- a **real, out-of-scope bug** you must not silently fix inside this PR;
- the issue is genuinely **too large for one PR** and must be split (file the follow-up slice(s));
- a **true prerequisite** is missing and blocks acceptance.

Before filing, `gh issue list --search "<keywords>"` to avoid duplicates. Use the existing labels
(`accessibility`, `content`, `tech-debt`, `learning-engine`, `enhancement`, `bug`, `documentation`,
`good first issue`, `P1`, `P2`) and reference the originating issue (`Found while working on #<N>`).
If nothing qualifies, create nothing — this is the common case.

### 8. Finish the iteration
Print a one-line summary: `RALPH: #<N> "<title>" → PR <url> (gates green)`. Stop. Do not start another
issue this run — the loop will re-invoke you.

### Guardrails
- If multi-agent orchestration is available this run (an `ultracode` / `--workflows` mode), you MAY use the
  Workflow tool — scoped to the single selected issue, still exactly one PR. Otherwise work solo; don't
  over-orchestrate. Small/mechanical issues never need it.
- One issue per run; one PR per issue; minimal diff.
- Generated files are outputs — change the generator, not the output.
- Keep `npm run check` and `npm test` green; that's the definition of done.
- Don't touch statutory sign colours/shapes; composites stay flagged as illustrations.
- No analytics, no backend, no new runtime dependencies unless the issue explicitly calls for it.
- If anything is ambiguous or risky beyond the issue's scope, stop and report rather than guessing.
