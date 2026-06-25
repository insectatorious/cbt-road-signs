<script lang="ts">
  import Icon from './Icon.svelte'
  import { store, downloadBackup, dismissBackupNudge } from '../lib/store.svelte'
  import { shouldNudgeBackup } from '../lib/backup'

  // A coarse clock so the nudge can also surface as the time-based thresholds
  // elapse while the app stays open (Date.now() alone isn't reactive).
  let now = $state(Date.now())
  $effect(() => {
    const id = setInterval(() => (now = Date.now()), 60_000)
    return () => clearInterval(id)
  })

  const show = $derived(
    shouldNudgeBackup({
      sessionCount: store.sessions.length,
      createdAt: store.createdAt,
      lastBackupAt: store.lastBackupAt,
      dismissedAt: store.backupNudgeDismissedAt,
      now,
    }),
  )
</script>

{#if show}
  <div class="nudge">
    <Icon name="download" size={18} />
    <span class="nudge__text" role="status">Progress is saved on this device only — keep a backup?</span>
    <div class="nudge__actions">
      <button class="nudge__btn nudge__btn--primary" onclick={downloadBackup}>Back up</button>
      <button class="nudge__btn" onclick={dismissBackupNudge}>Not now</button>
    </div>
  </div>
{/if}

<style>
  .nudge {
    display: flex;
    align-items: center;
    gap: var(--s-3);
    flex-wrap: wrap;
    padding: var(--s-3) var(--s-4);
    margin-bottom: var(--s-4);
    background: var(--accent-wash);
    border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--hairline));
    border-radius: var(--r-md);
    color: var(--text);
  }
  .nudge :global(svg) {
    color: var(--accent-ink);
    flex: none;
  }
  .nudge__text {
    flex: 1;
    min-width: 12ch;
    font-size: var(--fs-callout);
  }
  .nudge__actions {
    display: flex;
    gap: var(--s-2);
    flex: none;
  }
  .nudge__btn {
    padding: var(--s-2) var(--s-3);
    min-height: 38px;
    border-radius: var(--r-sm);
    font-size: var(--fs-caption);
    font-weight: var(--fw-semibold);
    color: var(--text-secondary);
  }
  .nudge__btn:hover {
    color: var(--text);
  }
  .nudge__btn--primary {
    background: var(--accent);
    color: var(--text-on-accent);
  }
  .nudge__btn--primary:hover {
    color: var(--text-on-accent);
    background: var(--accent-ink);
  }
</style>
