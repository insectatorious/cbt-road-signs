<script lang="ts">
  import { onMount, tick } from 'svelte'
  import Flashcard from '../components/Flashcard.svelte'
  import RecallBar from '../components/RecallBar.svelte'
  import BookmarkButton from '../components/BookmarkButton.svelte'
  import Icon from '../components/Icon.svelte'
  import UndoToast from '../components/UndoToast.svelte'
  import { store, activeSigns, gradeRecall, undoLastGrade, SIGN_BY_ID } from '../lib/store.svelte'
  import { buildStudyQueue, backlogPlan } from '../lib/deck'
  import { enterCard, gradeExit } from '../lib/motion'
  import { navigate } from '../lib/router.svelte'
  import { gradeShadeLabel, pct } from '../lib/util'

  const UNDO_MS = 5000

  let queue = $state<string[]>([])
  let info = $state({ dueCount: 0, newCount: 0, dueDeferred: 0 })
  let index = $state(0)
  let flipped = $state(false)
  let grading = $state(false) // in-flight guard: blocks double-grade during the exit animation
  let announce = $state('') // sr-only live-region text: correctness + inferred shade
  let done = $state(false)
  let reviewed = $state(0)
  let correct = $state(0)
  let stage = $state<HTMLElement>()

  let showUndo = $state(false) // the "Graded — Undo" toast window
  let undoTimer: ReturnType<typeof setTimeout> | undefined
  let lastIndex: number | null = null // queue index of the card just graded
  let lastGotIt = false // whether that grade was a hit (to revert the local correct tally)
  let destroyed = false // set on unmount so a pending exit-animation advance() can't fire on a dead view

  let shownAt = Date.now() // when the current front became visible (recall-latency clock)
  let thinkMs = 0 // time from shown → flip, captured at reveal

  const currentId = $derived(queue[index])
  const currentSign = $derived(currentId ? SIGN_BY_ID.get(currentId) : undefined)

  // catch-up mode: a large overdue pile is paced over several sessions (the per-
  // session cap defers the remainder), so a return after a break stays manageable.
  const plan = $derived(
    backlogPlan(info.dueCount + info.dueDeferred, store.settings.newPerDay, store.settings.reviewCap),
  )

  function build() {
    const q = buildStudyQueue(activeSigns(), store.reviews, store.settings.newPerDay, Date.now(), store.settings.shuffleCategories, store.settings.reviewCap)
    queue = q.ids
    info = { dueCount: q.dueCount, newCount: q.newCount, dueDeferred: q.dueDeferred }
    index = 0
    flipped = false
    grading = false
    done = false
    reviewed = 0
    correct = 0
    announce = ''
    hideUndo()
    shownAt = Date.now()
  }

  function flashUndo() {
    showUndo = true
    clearTimeout(undoTimer)
    undoTimer = setTimeout(() => (showUndo = false), UNDO_MS)
  }

  function hideUndo() {
    clearTimeout(undoTimer)
    showUndo = false
  }

  async function undo() {
    // A grade-exit animation is still in flight: its pending advance() would step
    // the queue forward and skip this card. Ignore undo until it settles (honours
    // the same in-flight guard answer() uses).
    if (grading) return
    hideUndo()
    if (lastIndex === null || !undoLastGrade()) return
    done = false
    index = lastIndex
    lastIndex = null
    flipped = false
    grading = false
    reviewed = Math.max(0, reviewed - 1)
    if (lastGotIt) correct = Math.max(0, correct - 1)
    announce = 'Grade undone — try this card again.'
    shownAt = Date.now()
    await tick()
    document.querySelector<HTMLButtonElement>('.controls .btn')?.focus()
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
    const g = gradeRecall(currentId, gotIt, thinkMs)
    // announce correctness + the inferred shade to assistive tech (WCAG 4.1.3).
    // The "press U to undo" hint is announced later, in advance(), once undo is
    // actually live — during the exit animation the grading guard still blocks it.
    announce = gotIt ? `Correct — marked ${gradeShadeLabel(g)}.` : 'Marked as missed.'
    lastIndex = index
    lastGotIt = gotIt
    reviewed += 1
    if (gotIt) correct += 1
    if (stage) gradeExit(stage, gotIt ? 1 : -1, advance)
    else advance()
  }

  async function advance() {
    if (destroyed) return // a late exit-animation callback after the view was torn down
    if (index + 1 >= queue.length) {
      done = true
      grading = false
      await tick()
      document.getElementById('view-heading')?.focus()
    } else {
      index += 1
      flipped = false
      shownAt = Date.now()
      await tick()
      if (stage) enterCard(stage)
      // mirror reveal()'s focus move so keyboard/SR focus isn't dropped to <body>
      document.querySelector<HTMLButtonElement>('.controls .btn')?.focus()
      grading = false
    }
    // Surface undo only after the transition has fully settled and `grading` is
    // back to false — otherwise the toast would show while undo()'s grading guard
    // still no-ops it. The SR hint here also doubles as the between-card reset so
    // an identical next result still re-announces.
    flashUndo()
    announce = 'Press U to undo.'
  }

  function onKey(e: KeyboardEvent) {
    // Undo works from anywhere in the window while the toast is up (incl. the
    // session-complete screen, so the final grade is recoverable too).
    if (showUndo && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault()
      undo()
      return
    }
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
    return () => {
      destroyed = true
      window.removeEventListener('keydown', onKey)
      clearTimeout(undoTimer)
    }
  })
</script>

<section class="study">
  <p class="sr-only" aria-live="polite" role="status">{announce}</p>
  {#if showUndo}<UndoToast onUndo={undo} />{/if}
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
        {#if info.dueDeferred > 0}
          <span class="count count--more" title="Capped to keep the session manageable — the rest is saved for later, not lost.">+<span class="t-num">{info.dueDeferred}</span> more today</span>
        {/if}
      </div>
      <span class="study__pos t-num">{index + 1} / {queue.length}</span>
    </header>

    {#if plan.active}
      <p class="catchup" role="status">
        <Icon name="info" size={15} />
        <span
          ><strong>Catch-up mode.</strong>
          {plan.dueTotal} reviews built up while you were away — we're serving about {plan.perDay} a
          session so it stays manageable (about {plan.days} {plan.days === 1 ? 'session' : 'sessions'}
          to clear). The spacing of everything else is untouched.</span
        >
      </p>
    {/if}

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
  .count--more {
    align-self: center;
    color: var(--accent);
  }
  .study__pos {
    font-size: var(--fs-caption);
    color: var(--text-muted);
  }

  .catchup {
    display: flex;
    align-items: flex-start;
    gap: var(--s-2);
    margin-top: var(--s-3);
    padding: var(--s-2) var(--s-3);
    background: var(--accent-wash);
    border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--hairline));
    border-radius: var(--r-sm);
    font-size: var(--fs-caption);
    color: var(--text-secondary);
  }
  .catchup :global(svg) {
    color: var(--accent-ink);
    flex: none;
    margin-top: 1px;
  }
  .catchup strong {
    color: var(--text);
  }

  .study__progress {
    height: 3px;
    background: var(--surface-sunken);
    border-radius: var(--r-pill);
    overflow: hidden;
  }
  .study__progress-fill {
    height: 100%;
    background: var(--accent);
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
