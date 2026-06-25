<script lang="ts">
  import { onMount, tick } from 'svelte'
  import Flashcard from '../components/Flashcard.svelte'
  import RecallBar from '../components/RecallBar.svelte'
  import BookmarkButton from '../components/BookmarkButton.svelte'
  import Icon from '../components/Icon.svelte'
  import { store, activeSigns, gradeRecall, SIGN_BY_ID } from '../lib/store.svelte'
  import { buildStudyQueue } from '../lib/deck'
  import { enterCard, gradeExit } from '../lib/motion'
  import { navigate } from '../lib/router.svelte'
  import { pct } from '../lib/util'

  let queue = $state<string[]>([])
  let info = $state({ dueCount: 0, newCount: 0 })
  let index = $state(0)
  let flipped = $state(false)
  let grading = $state(false) // in-flight guard: blocks double-grade during the exit animation
  let done = $state(false)
  let reviewed = $state(0)
  let correct = $state(0)
  let stage = $state<HTMLElement>()

  let shownAt = Date.now() // when the current front became visible (recall-latency clock)
  let thinkMs = 0 // time from shown → flip, captured at reveal

  const currentId = $derived(queue[index])
  const currentSign = $derived(currentId ? SIGN_BY_ID.get(currentId) : undefined)

  function build() {
    const q = buildStudyQueue(activeSigns(), store.reviews, store.settings.newPerDay, Date.now(), store.settings.shuffleCategories)
    queue = q.ids
    info = { dueCount: q.dueCount, newCount: q.newCount }
    index = 0
    flipped = false
    grading = false
    done = false
    reviewed = 0
    correct = 0
    shownAt = Date.now()
  }

  async function reveal() {
    if (flipped) return
    thinkMs = Date.now() - shownAt
    flipped = true
    await tick()
    document.querySelector<HTMLButtonElement>('.recall__btn--got')?.focus()
  }

  function answer(gotIt: boolean) {
    if (grading || !currentId) return
    grading = true
    gradeRecall(currentId, gotIt, thinkMs)
    reviewed += 1
    if (gotIt) correct += 1
    if (stage) gradeExit(stage, gotIt ? 1 : -1, advance)
    else advance()
  }

  async function advance() {
    if (index + 1 >= queue.length) {
      done = true
      grading = false
      await tick()
      document.getElementById('view-heading')?.focus()
      return
    }
    index += 1
    flipped = false
    shownAt = Date.now()
    await tick()
    if (stage) enterCard(stage)
    // mirror reveal()'s focus move so keyboard/SR focus isn't dropped to <body>
    document.querySelector<HTMLButtonElement>('.controls .btn')?.focus()
    grading = false
  }

  function onKey(e: KeyboardEvent) {
    if (done || !currentSign) return
    // Let the in-card "Details" disclosure and the save toggle handle their own
    // Enter/Space — without this, the global grade handler would also fire.
    const active = document.activeElement
    if (active instanceof HTMLElement && 'detailsToggle' in active.dataset) return
    if (active instanceof HTMLElement && active.closest('.study__save')) return
    if (!flipped) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        reveal()
      }
      return
    }
    if (e.key === '1' || e.key === 'ArrowLeft') {
      e.preventDefault()
      answer(false)
    } else if (e.key === '2' || e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      answer(true)
    }
  }

  onMount(() => {
    build()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
</script>

<section class="study">
  {#if done}
    <div class="done">
      <span class="done__check"><Icon name="check" size={26} /></span>
      <h1 class="t-title" id="view-heading" tabindex="-1">Session complete</h1>
      <p class="t-body done__sub">
        You reviewed <strong>{reviewed}</strong>
        {reviewed === 1 ? 'card' : 'cards'} at
        <strong>{pct(reviewed ? correct / reviewed : null)}</strong> recall.
      </p>
      <div class="done__actions">
        <button class="btn btn--primary" onclick={build}>Study more</button>
        <button class="btn btn--ghost" onclick={() => navigate('report')}>See report</button>
      </div>
    </div>
  {:else if !currentSign}
    <div class="done">
      <span class="done__check"><Icon name="check" size={26} /></span>
      <h1 class="t-title" id="view-heading" tabindex="-1">All caught up</h1>
      <p class="t-body done__sub">
        Nothing is due right now — you're all caught up. Come back when reviews are due, or browse the
        reference.
      </p>
      <div class="done__actions">
        <button class="btn btn--primary" onclick={() => navigate('browse')}>Browse the reference</button>
        <button class="btn btn--ghost" onclick={() => navigate('report')}>See report</button>
      </div>
    </div>
  {:else}
    <header class="study__head">
      <h1 class="sr-only" id="view-heading" tabindex="-1">Study</h1>
      <div class="study__counts">
        <span class="count"><span class="count__n t-num">{info.dueCount}</span> due</span>
        <span class="count"><span class="count__n t-num">{info.newCount}</span> new</span>
      </div>
      <span class="study__pos t-num">{index + 1} / {queue.length}</span>
    </header>

    <div class="study__progress" aria-hidden="true">
      <div class="study__progress-fill" style="transform:scaleX({queue.length ? index / queue.length : 0})"></div>
    </div>

    <div class="stage" bind:this={stage}>
      {#key currentId}
        <Flashcard
          sign={currentSign}
          {flipped}
          showHint={store.settings.showCategoryHint}
          onflip={reveal}
        />
      {/key}
    </div>

    {#if flipped}
      <!-- reveal-only: save the card you just checked. Pointer/Tab only — no hotkey,
           so it can't collide with the 1/2/Arrow grading keys (see onKey guard). -->
      <div class="study__save">
        <BookmarkButton id={currentSign.id} caption={currentSign.caption} variant="sheet" />
      </div>
    {/if}

    <div class="controls">
      {#if flipped}
        <RecallBar onAnswer={answer} />
      {:else}
        <button class="btn btn--primary btn--wide" onclick={reveal}>Reveal answer</button>
      {/if}
    </div>
  {/if}
</section>

<style>
  .study {
    display: flex;
    flex-direction: column;
    gap: var(--s-4);
    max-width: 480px;
    margin: 0 auto;
    min-height: calc(100dvh - var(--tabbar-h) - var(--s-8));
    /* Cap to the viewport so a long answer scrolls inside the card rather than
       pushing the grade buttons (.controls) below the fold on mobile. */
    max-height: calc(100dvh - var(--tabbar-h) - var(--s-8));
  }
  @media (min-width: 768px) {
    .study {
      min-height: auto;
      max-height: none;
      padding-top: var(--s-4);
    }
  }

  .study__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  .study__counts {
    display: flex;
    gap: var(--s-4);
  }
  .count {
    font-size: var(--fs-caption);
    color: var(--text-muted);
  }
  .count__n {
    font-size: var(--fs-heading);
    color: var(--text);
    margin-right: 3px;
  }
  .study__pos {
    font-size: var(--fs-caption);
    color: var(--text-muted);
  }

  .study__progress {
    height: 3px;
    background: var(--surface-sunken);
    border-radius: var(--r-pill);
    overflow: hidden;
  }
  .study__progress-fill {
    height: 100%;
    background: var(--amber);
    border-radius: var(--r-pill);
    transform-origin: left center;
    transition: transform var(--dur-base) var(--ease-standard);
  }

  .stage {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: stretch;
    will-change: transform, opacity;
  }
  .study__save {
    display: flex;
    justify-content: flex-end;
    margin-top: calc(-1 * var(--s-2));
  }
  .controls {
    min-height: 76px;
    display: flex;
    align-items: center;
  }

  .btn--wide {
    width: 100%;
  }

  .done {
    margin: auto;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--s-3);
    max-width: 36ch;
  }
  .done__check {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: var(--r-pill);
    color: var(--grade-good);
    background: color-mix(in srgb, var(--grade-good) 14%, transparent);
    margin-bottom: var(--s-2);
  }
  .done__sub {
    color: var(--text-secondary);
  }
  .done__actions {
    display: flex;
    gap: var(--s-2);
    margin-top: var(--s-3);
    flex-wrap: wrap;
    justify-content: center;
  }
</style>
