<script lang="ts">
  import { theme, setTheme, type ThemePref } from '../lib/theme.svelte'
  import Icon from './Icon.svelte'

  const options: { value: ThemePref; icon: string; label: string }[] = [
    { value: 'system', icon: 'monitor', label: 'System' },
    { value: 'light', icon: 'sun', label: 'Light' },
    { value: 'dark', icon: 'moon', label: 'Dark' },
  ]
</script>

<div class="seg" role="group" aria-label="Theme">
  {#each options as o (o.value)}
    <button
      class="seg__btn"
      class:is-active={theme.pref === o.value}
      aria-pressed={theme.pref === o.value}
      onclick={() => setTheme(o.value)}
    >
      <Icon name={o.icon} size={17} />
      <span>{o.label}</span>
    </button>
  {/each}
</div>

<style>
  .seg {
    display: inline-flex;
    gap: 2px;
    padding: 2px;
    background: var(--surface-sunken);
    border: 1px solid var(--hairline);
    border-radius: var(--r-pill);
  }
  .seg__btn {
    display: inline-flex;
    align-items: center;
    gap: var(--s-2);
    padding: var(--s-2) var(--s-4);
    min-height: 40px;
    border-radius: var(--r-pill);
    color: var(--text-muted);
    font-size: var(--fs-callout);
    font-weight: var(--fw-medium);
    transition:
      color var(--dur-fast) var(--ease-standard),
      background var(--dur-fast) var(--ease-standard);
  }
  .seg__btn:hover {
    color: var(--text-secondary);
  }
  .seg__btn.is-active {
    color: var(--text);
    background: var(--surface-raised);
    box-shadow: var(--shadow-1);
  }
</style>
