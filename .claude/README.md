# `.claude/` — Ralph loop tooling

Automation for working through this repo's open **GitHub issue** backlog, one issue per iteration.

| File | Role |
|------|------|
| `ralph-loop.md` | The **agent prompt** — fed verbatim to each iteration. Task-only; don't put run docs here. |
| `loop.sh` | The **bash runner** that drives the prompt and stops itself when the backlog drains. |
| `settings.local.json` | Your personal, untracked tool allowlist (permissions). Not committed. |

Each iteration a fresh, stateless agent re-orients from the live repo, completes exactly one issue end to
end behind the `check`/`test`/`build` gates, opens a PR (`Closes #N`), and stops. Selection is deterministic
(`P1` → `P2` → rest, lowest number first); issues already covered by an open PR are skipped; a crashed
`issue-<N>-*` branch is resumed. The queue is GitHub issues — there is no separate backlog file.

## Run it — `loop.sh` (recommended)

```bash
./.claude/loop.sh --once                                  # next single issue, then stop (great first run)
./.claude/loop.sh --workflows --auto-merge --unattended   # full auto, NO permission bypass
./.claude/loop.sh --workflows --auto-merge --unattended -n 5   # ...capped at 5 issues
./.claude/loop.sh --dry-run                               # preview the assembled prompt + claude command
```

Flags (`./.claude/loop.sh --help` for the full list):

| Flag | Effect |
|------|--------|
| `-n, --max N` | Stop after N iterations (default: unlimited). |
| `-s, --sleep SEC` | Pause between iterations (default: 5). |
| `--once` | Single iteration (alias for `--max 1`). |
| `--workflows` | Append a section authorising multi-agent Workflow orchestration on large/cross-cutting issues. Still one PR. |
| `--auto-merge` | Append an instruction to enable PR auto-merge once CI is green. |
| `--unattended` | Hands-off via `--permission-mode acceptEdits` (auto-applies edits). **No** permission bypass — relies on your allowlist for Bash/tools. Alias: `--accept-edits`. |
| `--yolo` | `--dangerously-skip-permissions` (bypasses everything). Stronger than `--unattended`; wins if both given. |
| `--dry-run` | Print the assembled prompt + invocation, then exit. |
| `-- <flags>` | Forward arbitrary flags to `claude` (e.g. `-- --model opus`). |

The runner stops on the `RALPH: backlog drained` sentinel, a non-zero `claude` exit, or `--max`.

## Run it — other drivers

**Manual loop (no runner):**
```bash
while :; do claude -p "$(cat .claude/ralph-loop.md)" || break; sleep 5; done
```

**A `ralph-loop` plugin / external driver** (re-feeds the prompt, stops on a completion token):
```
/ralph-loop:ralph-loop "ultracode $(cat .claude/ralph-loop.md)" --completion-promise OBJECTIVE_COMPLETE --max-iterations 25
```
- `ultracode` prefix → multi-agent orchestration on (same intent as `--workflows`).
- `--completion-promise OBJECTIVE_COMPLETE` matches the token the prompt prints when the backlog is drained.
- `--max-iterations` should comfortably exceed the open-issue count (a blocked/resumed issue can take >1).

**Claude Code `/loop`:** run `/loop` pointed at `ralph-loop.md`, or `/loop` self-paced.

## Permissions (for unattended runs)

`--unattended` auto-applies file **edits** but the loop also runs **Bash** (git, gh, npm, npx) and the
**Workflow** tool. Those must be pre-approved or a headless run stalls on the first one. Add the patterns
the loop uses to `.claude/settings.local.json` (or grant them via `/permissions`); it already permits some
git/`npm run`/`gh` commands. For attended runs you can instead approve prompts as they appear. `--yolo`
removes the need for an allowlist but bypasses all checks — only on a repo you're happy to hand over.
