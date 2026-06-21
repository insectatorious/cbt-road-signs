<script lang="ts">
  // Just the correctness call — the Hard/Good/Easy shade is inferred from how
  // long the recall took (see lib/pace.ts).
  let { onAnswer }: { onAnswer: (gotIt: boolean) => void } = $props()
</script>

<div class="recall" role="group" aria-label="Did you remember it?">
  <button class="recall__btn recall__btn--miss" onclick={() => onAnswer(false)}>
    <span>Missed it</span>
    <kbd aria-hidden="true">1</kbd>
  </button>
  <button class="recall__btn recall__btn--got" onclick={() => onAnswer(true)}>
    <span>Got it</span>
    <kbd aria-hidden="true">2</kbd>
  </button>
</div>

<style>
  .recall {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--s-3);
    width: 100%;
  }
  .recall__btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 56px;
    padding: var(--s-3);
    border-radius: var(--r-sm);
    border: 1px solid var(--c);
    background: color-mix(in srgb, var(--c) 12%, transparent);
    color: var(--text);
    font-size: var(--fs-callout);
    font-weight: var(--fw-semibold);
    transition:
      background var(--dur-fast) var(--ease-standard),
      transform var(--dur-instant) var(--ease-standard);
  }
  .recall__btn:hover {
    background: color-mix(in srgb, var(--c) 20%, transparent);
  }
  .recall__btn:active {
    transform: translateY(1px);
  }
  .recall__btn kbd {
    position: absolute;
    top: 6px;
    right: 8px;
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--text-faint);
  }
  .recall__btn--miss {
    --c: var(--grade-again);
  }
  .recall__btn--got {
    --c: var(--grade-good);
  }
</style>
