#!/usr/bin/env bash
# Ralph loop runner — drives .claude/ralph-loop.md repeatedly, ONE issue per iteration.
#
# Each iteration spawns a fresh, stateless agent that re-orients from the live repo,
# completes a single open issue end-to-end, opens a PR, and stops. Re-running makes
# continuous progress. The loop terminates automatically when the prompt prints the
# "RALPH: backlog drained" sentinel, on a non-zero claude exit, or after --max runs.
#
# See `loop.sh --help` for usage. Quality gates (check/test/build) live in the prompt,
# not here — this script only orchestrates the repetition.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPT_FILE="$HERE/ralph-loop.md"

MAX=0            # 0 = unlimited
SLEEP=5
WORKFLOWS=0
AUTO_MERGE=0
ACCEPT_EDITS=0
YOLO=0
DRY_RUN=0
CLAUDE_BIN="${CLAUDE_BIN:-claude}"
PASSTHRU=()

usage() {
  cat <<'EOF'
Usage: .claude/loop.sh [options] [-- <extra claude flags>]

Drives the Ralph loop prompt (.claude/ralph-loop.md). Each iteration a fresh agent
completes ONE issue end-to-end and opens a PR. The loop stops automatically when the
backlog is drained (it watches for the "RALPH: backlog drained" sentinel), on error,
or after --max iterations.

Options:
  -n, --max N      Stop after N iterations           (default: unlimited)
  -s, --sleep SEC  Pause between iterations           (default: 5)
      --once       Single iteration (alias: --max 1)
      --workflows  Allow the agent to use multi-agent Workflow orchestration on large
                   / cross-cutting issues. More thorough, more tokens. Still one PR.
      --auto-merge Have the agent enable PR auto-merge so it lands once CI is green.
      --unattended Run hands-off WITHOUT bypassing permissions: passes
                   --permission-mode acceptEdits (auto-applies file edits) and relies on
                   the Bash/tool allowlist in .claude/settings.local.json for the rest.
                   This is the no-yolo unattended path. (alias: --accept-edits)
      --yolo       Pass --dangerously-skip-permissions to claude (bypasses ALL checks).
                   Stronger than --unattended; use only if you accept that risk. If both
                   are given, --yolo wins.
      --dry-run    Print the assembled prompt + the claude invocation, then exit.
  -h, --help       Show this help.

Examples:
  .claude/loop.sh --once                          # do the next single issue, then stop
  .claude/loop.sh --unattended                     # hands-off, no permission bypass
  .claude/loop.sh --workflows --auto-merge --unattended  # the full auto, no-yolo run
  .claude/loop.sh --workflows --auto-merge --unattended -n 5  # ...capped at 5 issues
  .claude/loop.sh -- --model opus                  # forward arbitrary flags through to claude

Env:
  CLAUDE_BIN   path to the claude executable (default: claude)

SAFETY: --yolo skips permission prompts for the whole run (file edits, npm, git, gh,
network). Only use it on a repo/branch you're happy to have an agent drive unattended.
Prefer a scoped permission allowlist in your Claude settings for routine use.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    -n|--max)    MAX="$2"; shift 2;;
    -s|--sleep)  SLEEP="$2"; shift 2;;
    --once)      MAX=1; shift;;
    --workflows) WORKFLOWS=1; shift;;
    --auto-merge) AUTO_MERGE=1; shift;;
    --unattended|--accept-edits) ACCEPT_EDITS=1; shift;;
    --yolo)      YOLO=1; shift;;
    --dry-run)   DRY_RUN=1; shift;;
    -h|--help)   usage; exit 0;;
    --)          shift; PASSTHRU=("$@"); break;;
    *)           echo "Unknown option: $1" >&2; usage; exit 2;;
  esac
done

command -v "$CLAUDE_BIN" >/dev/null 2>&1 || { echo "error: '$CLAUDE_BIN' not on PATH" >&2; exit 127; }
[ -f "$PROMPT_FILE" ] || { echo "error: prompt not found: $PROMPT_FILE" >&2; exit 1; }

PROMPT="$(cat "$PROMPT_FILE")"

# --- optional addenda appended to the piped prompt -------------------------------
if [ "$WORKFLOWS" -eq 1 ]; then
  PROMPT+=$'\n\n---\n\n## Multi-agent orchestration — ENABLED for this run\n\n'
  PROMPT+=$'You are explicitly authorized to use the Workflow tool (orchestrate subagents) when the SELECTED '
  PROMPT+=$'issue is large or cross-cutting enough to benefit — e.g. a parallel understand → implement → '
  PROMPT+=$'adversarially-verify pass, or fanning a repetitive change across many files. Rules: keep every '
  PROMPT+=$'workflow scoped to the single selected issue; still produce exactly ONE PR; prefer '
  PROMPT+=$'pipeline()/parallel() and verify findings before acting. For small or mechanical issues, work '
  PROMPT+=$'solo — do not over-orchestrate. Token cost is not a constraint when this mode is on.\n'
fi

if [ "$AUTO_MERGE" -eq 1 ]; then
  PROMPT+=$'\n\n## Auto-merge — ENABLED for this run\n\n'
  PROMPT+=$'After opening the PR (step 6), enable auto-merge so it lands once CI passes:\n'
  PROMPT+=$'`gh pr merge --auto --squash`. Never merge manually or bypass failing checks.\n'
fi

# --- claude invocation -----------------------------------------------------------
CLAUDE_ARGS=(-p)
if [ "$YOLO" -eq 1 ]; then
  CLAUDE_ARGS+=(--dangerously-skip-permissions)            # bypass everything (strongest)
elif [ "$ACCEPT_EDITS" -eq 1 ]; then
  CLAUDE_ARGS+=(--permission-mode acceptEdits)             # auto-edits; Bash via allowlist
fi
[ "${#PASSTHRU[@]}" -gt 0 ] && CLAUDE_ARGS+=("${PASSTHRU[@]}")

if [ "$DRY_RUN" -eq 1 ]; then
  echo "# command: $CLAUDE_BIN ${CLAUDE_ARGS[*]} \"<prompt>\""
  echo "# ---------------- assembled prompt ----------------"
  printf '%s\n' "$PROMPT"
  exit 0
fi

i=0
while :; do
  i=$((i + 1))
  if [ "$MAX" -gt 0 ] && [ "$i" -gt "$MAX" ]; then
    echo "ralph: reached max ($MAX) iteration(s) — stopping"
    break
  fi
  echo "================= ralph iteration $i ================="
  tmp="$(mktemp)"
  "$CLAUDE_BIN" "${CLAUDE_ARGS[@]}" "$PROMPT" 2>&1 | tee "$tmp"
  rc=${PIPESTATUS[0]}
  out="$(cat "$tmp")"; rm -f "$tmp"
  if [ "$rc" -ne 0 ]; then
    echo "ralph: claude exited $rc — stopping" >&2
    exit "$rc"
  fi
  if printf '%s' "$out" | grep -q "RALPH: backlog drained"; then
    echo "ralph: backlog drained — done after $i iteration(s)"
    break
  fi
  echo "ralph: iteration $i complete; sleeping ${SLEEP}s (Ctrl-C to stop)"
  sleep "$SLEEP"
done
