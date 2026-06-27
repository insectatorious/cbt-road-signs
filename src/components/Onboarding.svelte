<script lang="ts">
  /** First-run intro: a one-screen explainer shown until the learner dismisses it
   *  (persisted via the `onboarded` setting, so it never reappears). Reuses the
   *  focus-trapping modal action; CTA drops straight into Study. */
  import Icon from './Icon.svelte'
  import { modal } from '../lib/a11y'
  import { setSetting } from '../lib/store.svelte'
  import { navigate } from '../lib/router.svelte'

  let startBtn = $state<HTMLButtonElement>()

  $effect(() => {
    startBtn?.focus()
  })

  function dismiss() {
    setSetting('onboarded', true)
  }
  function start() {
    dismiss()
    navigate('study')
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') dismiss()
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="modal-root" use:modal>
  <div
    class="overlay"
    role="button"
    tabindex="-1"
    aria-label="Dismiss"
    onclick={dismiss}
    onkeydown={(e) => e.key === 'Enter' && dismiss()}
  ></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="onb-title">
    <span class="sheet__badge t-micro">Welcome</span>
    <h2 class="t-title" id="onb-title">Learn the UK road signs, the easy way</h2>
    <ul class="points">
      <li class="point">
        <span class="point__icon"><Icon name="layers" size={18} /></span>
        <span
          ><strong>Learn at your pace.</strong> A few signs a day — the app spaces them out over time
          so they stick, no cramming.</span
        >
      </li>
      <li class="point">
        <span class="point__icon"><Icon name="check" size={18} /></span>
        <span
          ><strong>Just say “Got it” or “Missed”.</strong> Flip a card, answer honestly, and it works
          out when to show you each sign again.</span
        >
      </li>
      <li class="point">
        <span class="point__icon"><Icon name="target" size={18} /></span>
        <span
          ><strong>Start with the core signs.</strong> The ones you’re most likely to meet on the road
          — ideal prep for your CBT.</span
        >
      </li>
    </ul>
    <div class="sheet__actions">
      <button class="btn btn--primary" onclick={start} bind:this={startBtn}>
        <Icon name="layers" size={18} /> Start studying
      </button>
      <button class="btn btn--ghost" onclick={dismiss}>Look around first</button>
    </div>
  </div>
</div>

<style>
  .modal-root {
    display: contents;
  }
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 90;
    background: color-mix(in srgb, var(--ink-100) 45%, transparent);
    backdrop-filter: blur(1px);
    animation: fade var(--dur-fast) var(--ease-standard);
  }
  .sheet {
    position: fixed;
    z-index: 91;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: 100%;
    max-width: 480px;
    max-height: 92dvh;
    overflow-y: auto;
    background: var(--surface-raised);
    border: 1px solid var(--border);
    border-radius: var(--r-lg) var(--r-lg) 0 0;
    padding: var(--s-5);
    box-shadow: var(--shadow-3);
    animation: rise var(--dur-base) var(--ease-standard);
  }
  @media (min-width: 600px) {
    .sheet {
      bottom: auto;
      top: 50%;
      transform: translate(-50%, -50%);
      border-radius: var(--r-lg);
      animation: pop var(--dur-base) var(--ease-standard);
    }
  }
  .sheet__badge {
    color: var(--accent-ink);
  }
  .sheet h2 {
    margin: var(--s-1) 0 var(--s-4);
  }
  .points {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--s-4);
  }
  .point {
    display: flex;
    gap: var(--s-3);
    align-items: flex-start;
    font-size: var(--fs-callout);
    color: var(--text-secondary);
  }
  .point strong {
    color: var(--text);
  }
  .point__icon {
    flex: none;
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: var(--r-pill);
    background: var(--accent-wash);
    color: var(--accent-ink);
  }
  .sheet__actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s-2);
    margin-top: var(--s-5);
  }
</style>
