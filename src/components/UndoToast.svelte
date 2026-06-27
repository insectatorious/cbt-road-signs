<script lang="ts">
  /** Brief "Graded — Undo" affordance shown after a grade. Purely presentational:
   *  the parent view owns the show/auto-dismiss timer and the undo action. The
   *  grade result itself is announced by each view's own aria-live region, so this
   *  toast is not a live region (it would double-speak). */
  import Icon from './Icon.svelte'

  let { onUndo }: { onUndo: () => void } = $props()
</script>

<div class="undo-toast">
  <span class="undo-toast__msg">Graded</span>
  <button class="undo-toast__btn" onclick={onUndo}>
    <Icon name="undo" size={16} />
    Undo
    <kbd aria-hidden="true">U</kbd>
  </button>
</div>

<style>
  /* Anchored to the top so it never covers the bottom-pinned grade / Next
     controls (which the learner is about to use). */
  .undo-toast {
    position: fixed;
    left: 50%;
    top: calc(env(safe-area-inset-top, 0px) + var(--s-3));
    transform: translateX(-50%);
    z-index: 80;
    display: flex;
    align-items: center;
    gap: var(--s-3);
    padding: var(--s-2) var(--s-2) var(--s-2) var(--s-4);
    background: var(--surface-raised);
    border: 1px solid var(--border);
    border-radius: var(--r-pill);
    box-shadow: var(--shadow-3);
    animation: undo-rise var(--dur-base) var(--ease-standard);
  }
  .undo-toast__msg {
    font-size: var(--fs-caption);
    color: var(--text-secondary);
  }
  .undo-toast__btn {
    display: inline-flex;
    align-items: center;
    gap: var(--s-2);
    min-height: 36px;
    padding: 0 var(--s-3);
    border-radius: var(--r-pill);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font-size: var(--fs-caption);
    font-weight: var(--fw-semibold);
  }
  .undo-toast__btn:hover {
    background: var(--surface-hover);
    border-color: var(--border-strong);
  }
  .undo-toast__btn kbd {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--text-faint);
    border: 1px solid var(--hairline);
    border-radius: 3px;
    padding: 0 4px;
  }

  @keyframes undo-rise {
    from {
      opacity: 0;
      transform: translate(-50%, -8px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .undo-toast {
      animation: none;
    }
  }
</style>
