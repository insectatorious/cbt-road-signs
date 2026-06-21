<script lang="ts">
  import { onMount } from 'svelte'
  import ThemeControl from '../components/ThemeControl.svelte'
  import Switch from '../components/Switch.svelte'
  import Icon from '../components/Icon.svelte'
  import { store, setSetting, resetProgress, downloadBackup, importData, SIGNS } from '../lib/store.svelte'
  import { requestPersistence, storageStatus, storageEstimate } from '../lib/storage'

  let confirming = $state(false)
  let importMsg = $state('')
  let fileInput = $state<HTMLInputElement>()

  let storageSupported = $state(false)
  let storagePersisted = $state(false)
  let usageKb = $state<number | null>(null)

  const edgeCount = SIGNS.filter((s) => s.tier === 'edge').length

  async function refreshStorage() {
    const st = await storageStatus()
    storageSupported = st.supported
    storagePersisted = st.persisted
    const est = await storageEstimate()
    usageKb = est ? Math.max(1, Math.round(est.usage / 1024)) : null
  }

  async function protectStorage() {
    await requestPersistence()
    await refreshStorage()
  }

  onMount(refreshStorage)

  function clampNew(v: number) {
    setSetting('newPerDay', Math.max(3, Math.min(40, v)))
  }

  function doReset() {
    resetProgress()
    confirming = false
  }

  async function onFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const text = await file.text()
    importMsg = importData(text) ? 'Progress imported.' : 'That file could not be read.'
    if (fileInput) fileInput.value = ''
  }
</script>

<section class="settings">
  <header class="settings__head">
    <h1 class="t-display" id="view-heading" tabindex="-1">Settings</h1>
  </header>

  <div class="group">
    <span class="group__label t-micro">Appearance</span>
    <div class="row">
      <div class="row__text">
        <span class="row__title">Theme</span>
        <span class="row__desc t-caption">System follows your device. Dark mode is a dim, warm charcoal.</span>
      </div>
      <ThemeControl />
    </div>
  </div>

  <div class="group">
    <span class="group__label t-micro">Study</span>

    <div class="row">
      <div class="row__text">
        <span class="row__title">New signs per day</span>
        <span class="row__desc t-caption">How many unseen signs to introduce each day.</span>
      </div>
      <div class="stepper">
        <button onclick={() => clampNew(store.settings.newPerDay - 1)} aria-label="Fewer">−</button>
        <span class="stepper__val t-num">{store.settings.newPerDay}</span>
        <button onclick={() => clampNew(store.settings.newPerDay + 1)} aria-label="More">+</button>
      </div>
    </div>

    <div class="row">
      <div class="row__text">
        <span class="row__title">Show category hint</span>
        <span class="row__desc t-caption">Reveal the sign family (e.g. “Warning”) on the card front.</span>
      </div>
      <Switch label="Show category hint" checked={store.settings.showCategoryHint} onchange={(v) => setSetting('showCategoryHint', v)} />
    </div>

    <div class="row">
      <div class="row__text">
        <span class="row__title">Include rare signs</span>
        <span class="row__desc t-caption">Add {edgeCount} less-common “edge” signs to your study deck.</span>
      </div>
      <Switch label="Include rare signs" checked={store.settings.includeEdge} onchange={(v) => setSetting('includeEdge', v)} />
    </div>

    <div class="row">
      <div class="row__text">
        <span class="row__title">Include road markings</span>
        <span class="row__desc t-caption">Study road markings and traffic-light signals too.</span>
      </div>
      <Switch label="Include road markings" checked={store.settings.includeMarkings} onchange={(v) => setSetting('includeMarkings', v)} />
    </div>
  </div>

  <div class="group">
    <span class="group__label t-micro">Storage</span>
    <div class="row">
      <div class="row__text">
        <span class="row__title">{storagePersisted ? 'Protected from eviction' : 'Best-effort storage'}</span>
        <span class="row__desc t-caption">
          {#if storagePersisted}The browser won’t clear your progress to free up space.{:else if storageSupported}The browser may clear your progress to free space — protect it to prevent that.{:else}Saved locally in this browser.{/if}
          {#if usageKb != null}{' · '}{usageKb} KB used{/if}
        </span>
      </div>
      {#if storageSupported && !storagePersisted}
        <button class="btn btn--ghost" onclick={protectStorage}>Protect</button>
      {/if}
    </div>
  </div>

  <div class="group">
    <span class="group__label t-micro">Your data</span>
    <p class="group__note t-caption">Progress is saved on this device only. Export a backup, or move it to another browser.</p>
    <div class="data-actions">
      <button class="btn btn--ghost" onclick={downloadBackup}><Icon name="download" size={17} /> Export</button>
      <button class="btn btn--ghost" onclick={() => fileInput?.click()}><Icon name="upload" size={17} /> Import</button>
      <input bind:this={fileInput} type="file" accept="application/json" onchange={onFile} hidden />
    </div>
    {#if importMsg}<p class="import-msg t-caption">{importMsg}</p>{/if}

    {#if confirming}
      <div class="confirm">
        <span class="t-caption">Erase all progress on this device? This can’t be undone.</span>
        <div class="confirm__actions">
          <button class="btn btn--danger" onclick={doReset}>Erase everything</button>
          <button class="btn btn--ghost" onclick={() => (confirming = false)}>Cancel</button>
        </div>
      </div>
    {:else}
      <button class="reset" onclick={() => (confirming = true)}><Icon name="trash" size={16} /> Reset all progress</button>
    {/if}
  </div>

  <div class="group">
    <span class="group__label t-micro">About</span>
    <p class="about t-caption">
      A focused revision tool for the UK motorcycle CBT road signs. Sign artwork is
      Crown copyright, reproduced under the Open Government Licence v3.0 via Wikimedia Commons.
      Motorway signs are out of scope for now.
    </p>
  </div>
</section>

<style>
  .settings {
    display: flex;
    flex-direction: column;
    gap: var(--s-6);
    max-width: 640px;
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
  }
  .group__label {
    padding-bottom: var(--s-1);
  }
  .group__note {
    margin-bottom: var(--s-2);
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--s-4);
    padding: var(--s-3) 0;
    border-top: 1px solid var(--divider);
  }
  .row__text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .row__title {
    font-size: var(--fs-callout);
    font-weight: var(--fw-medium);
  }
  .row__desc {
    max-width: 42ch;
  }

  .stepper {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--s-1);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    padding: 2px;
  }
  .stepper button {
    width: 34px;
    height: 34px;
    border-radius: var(--r-xs);
    font-size: 20px;
    color: var(--text-secondary);
  }
  .stepper button:hover {
    background: var(--surface-hover);
  }
  .stepper__val {
    min-width: 30px;
    text-align: center;
    font-weight: var(--fw-semibold);
  }

  .data-actions {
    display: flex;
    gap: var(--s-2);
    margin-top: var(--s-1);
  }
  .import-msg {
    margin-top: var(--s-2);
    color: var(--text-secondary);
  }

  .reset {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: var(--s-2);
    margin-top: var(--s-3);
    color: var(--grade-again);
    font-size: var(--fs-callout);
    font-weight: var(--fw-medium);
  }
  .reset:hover {
    text-decoration: underline;
  }
  .confirm {
    margin-top: var(--s-3);
    padding: var(--s-3);
    border: 1px solid color-mix(in srgb, var(--grade-again) 40%, var(--border));
    border-radius: var(--r-sm);
    background: color-mix(in srgb, var(--grade-again) 8%, transparent);
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
  }
  .confirm__actions {
    display: flex;
    gap: var(--s-2);
  }
  .about {
    max-width: 56ch;
    line-height: 1.5;
  }
</style>
