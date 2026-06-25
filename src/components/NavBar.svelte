<script lang="ts">
  import { router, navigate, type Route } from '../lib/router.svelte'
  import Icon from './Icon.svelte'

  const tabs: { route: Route; icon: string; label: string }[] = [
    { route: 'study', icon: 'layers', label: 'Study' },
    { route: 'quiz', icon: 'help', label: 'Quiz' },
    { route: 'browse', icon: 'search', label: 'Reference' },
    { route: 'report', icon: 'chart', label: 'Report' },
    { route: 'settings', icon: 'sliders', label: 'Settings' },
  ]
</script>

<nav class="nav" aria-label="Primary">
  <span class="nav__brand" aria-hidden="true">
    <svg viewBox="0 0 64 64" width="26" height="26">
      <circle cx="32" cy="32" r="18" fill="none" stroke="currentColor" stroke-width="5" />
      <circle cx="32" cy="32" r="6.5" fill="var(--accent)" />
    </svg>
  </span>
  {#each tabs as tab (tab.route)}
    <button
      class="nav__tab"
      class:is-active={router.route === tab.route}
      aria-current={router.route === tab.route ? 'page' : undefined}
      onclick={() => navigate(tab.route)}
    >
      <span class="nav__indicator" aria-hidden="true"></span>
      <Icon name={tab.icon} size={22} />
      <span class="nav__label">{tab.label}</span>
    </button>
  {/each}
</nav>

<style>
  .nav {
    position: fixed;
    z-index: 50;
    inset: auto 0 0 0;
    height: calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px));
    padding-bottom: env(safe-area-inset-bottom, 0px);
    display: flex;
    align-items: stretch;
    background: var(--surface);
    border-top: 1px solid var(--hairline);
  }

  .nav__brand {
    display: none;
    color: var(--text);
  }

  .nav__tab {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-height: var(--touch-min);
    color: var(--text-muted);
    transition: color var(--dur-fast) var(--ease-standard);
  }
  .nav__tab:hover {
    color: var(--text-secondary);
  }
  .nav__tab.is-active {
    color: var(--accent);
  }

  .nav__label {
    font-size: var(--fs-micro);
    letter-spacing: var(--ls-micro);
    font-weight: var(--fw-semibold);
  }

  .nav__indicator {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%) scaleX(0);
    width: 26px;
    height: 2px;
    background: var(--accent);
    border-radius: var(--r-pill);
    transition: transform var(--dur-base) var(--ease-standard);
  }
  .nav__tab.is-active .nav__indicator {
    transform: translateX(-50%) scaleX(1);
  }

  /* ---- Desktop: bottom bar becomes a left rail ---- */
  @media (min-width: 768px) {
    .nav {
      inset: 0 auto 0 0;
      width: var(--rail-w);
      height: 100dvh;
      padding: var(--s-4) 0;
      padding-bottom: var(--s-4);
      flex-direction: column;
      align-items: stretch;
      gap: var(--s-1);
      border-top: none;
      border-right: 1px solid var(--hairline);
    }
    .nav__brand {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 48px;
      margin-bottom: var(--s-4);
    }
    .nav__tab {
      flex: 0 0 auto;
      padding: var(--s-3) 0;
      gap: 5px;
    }
    /* keep long labels (Reference / Settings) comfortably inside the rail */
    .nav__label {
      font-size: 10px;
      letter-spacing: 0.02em;
    }
    .nav__indicator {
      top: 50%;
      left: 0;
      transform: translateY(-50%) scaleY(0);
      width: 3px;
      height: 60%;
    }
    .nav__tab.is-active .nav__indicator {
      transform: translateY(-50%) scaleY(1);
    }
  }
</style>
