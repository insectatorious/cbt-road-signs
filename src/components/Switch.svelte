<script lang="ts">
  let {
    checked,
    onchange,
    label,
  }: { checked: boolean; onchange: (v: boolean) => void; label: string } = $props()
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={label}
  class="switch"
  class:is-on={checked}
  onclick={() => onchange(!checked)}
>
  <span class="switch__thumb"></span>
</button>

<style>
  .switch {
    flex: none;
    width: 46px;
    height: 28px;
    border-radius: var(--r-pill);
    background: var(--surface-sunken);
    border: 1px solid var(--border);
    padding: 2px;
    transition:
      background var(--dur-base) var(--ease-standard),
      border-color var(--dur-base) var(--ease-standard);
  }
  .switch.is-on {
    background: var(--amber-strong);
    border-color: var(--amber-strong);
  }
  .switch__thumb {
    display: block;
    width: 22px;
    height: 22px;
    border-radius: var(--r-pill);
    background: var(--surface-raised);
    box-shadow: var(--shadow-1);
    transition: transform var(--dur-base) var(--ease-spring);
  }
  .switch.is-on .switch__thumb {
    transform: translateX(18px);
  }
</style>
