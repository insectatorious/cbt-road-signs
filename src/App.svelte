<script lang="ts">
  import { router } from './lib/router.svelte'
  import NavBar from './components/NavBar.svelte'
  import BackupNudge from './components/BackupNudge.svelte'
  import StorageWarning from './components/StorageWarning.svelte'
  import Study from './views/Study.svelte'
  import Quiz from './views/Quiz.svelte'
  import Browse from './views/Browse.svelte'
  import Report from './views/Report.svelte'
  import Settings from './views/Settings.svelte'

  const views = { study: Study, quiz: Quiz, browse: Browse, report: Report, settings: Settings }
  let Current = $derived(views[router.route])
</script>

<a class="skip" href="#main">Skip to content</a>
<div class="app">
  <main class="app__main" id="main" tabindex="-1">
    <div class="app__inner">
      <StorageWarning />
      <BackupNudge />
      {#key router.route}
        <Current />
      {/key}
    </div>
  </main>
  <NavBar />
</div>

<style>
  .app__main {
    min-height: 100dvh;
    padding-bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px));
  }
  .app__inner {
    max-width: var(--wide-max);
    margin: 0 auto;
    padding: var(--s-4) var(--s-4) var(--s-6);
  }
  @media (min-width: 768px) {
    .app__main {
      padding-bottom: 0;
      padding-left: var(--rail-w);
    }
    .app__inner {
      padding: var(--s-6) var(--s-6) var(--s-7);
    }
  }
  @media (min-width: 1280px) {
    .app__inner {
      padding: var(--s-7) var(--s-7) var(--s-8);
    }
  }

  .skip {
    position: absolute;
    left: var(--s-3);
    top: -200px;
    z-index: 100;
    background: var(--surface-raised);
    color: var(--text);
    padding: var(--s-2) var(--s-3);
    border-radius: var(--r-sm);
    border: 1px solid var(--border);
  }
  .skip:focus {
    top: var(--s-3);
  }
</style>
