<script lang="ts">
  /** Non-blocking banner shown when localStorage is unavailable or a save has
   *  failed: progress is held in memory only and would be lost on close, so we
   *  point the learner at Export as a fallback. Modelled on BackupNudge. */
  import Icon from './Icon.svelte'
  import { storageHealth, dismissStorageWarning, downloadBackup } from '../lib/store.svelte'
</script>

{#if storageHealth.blocked && !storageHealth.dismissed}
  <div class="warn" role="alert">
    <Icon name="alert" size={18} />
    <span class="warn__text">
      Progress can’t be saved on this device — it’s kept in memory only and will be lost when
      you close this tab. This usually means private/incognito browsing or that storage is full.
      Export a backup to keep it.
    </span>
    <div class="warn__actions">
      <button class="warn__btn warn__btn--primary" onclick={downloadBackup}>Export backup</button>
      <button class="warn__btn" onclick={dismissStorageWarning}>Dismiss</button>
    </div>
  </div>
{/if}

<style>
  .warn {
    display: flex;
    align-items: center;
    gap: var(--s-3);
    flex-wrap: wrap;
    padding: var(--s-3) var(--s-4);
    margin-bottom: var(--s-4);
    background: color-mix(in srgb, var(--grade-again) 12%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--grade-again) 50%, var(--hairline));
    border-radius: var(--r-md);
    color: var(--text);
  }
  .warn :global(svg) {
    color: var(--grade-again);
    flex: none;
  }
  .warn__text {
    flex: 1;
    min-width: 12ch;
    font-size: var(--fs-callout);
  }
  .warn__actions {
    display: flex;
    gap: var(--s-2);
    flex: none;
  }
  .warn__btn {
    padding: var(--s-2) var(--s-3);
    min-height: 38px;
    border-radius: var(--r-sm);
    font-size: var(--fs-caption);
    font-weight: var(--fw-semibold);
    color: var(--text-secondary);
  }
  .warn__btn:hover {
    color: var(--text);
  }
  .warn__btn--primary {
    background: var(--grade-again);
    color: var(--text-on-accent);
  }
  .warn__btn--primary:hover {
    color: var(--text-on-accent);
    background: color-mix(in srgb, var(--grade-again) 85%, var(--ink-100));
  }
</style>
