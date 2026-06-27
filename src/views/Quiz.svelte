<script lang="ts">
  import { onMount, tick } from 'svelte'
  import SignPlate from '../components/SignPlate.svelte'
  import Icon from '../components/Icon.svelte'
  import UndoToast from '../components/UndoToast.svelte'
  import { store, activeSigns, gradeQuiz, undoLastGrade, takeQuizFocus, SIGN_BY_ID } from '../lib/store.svelte'
  import { buildStudyQueue } from '../lib/deck'
  import { buildQuestion, type QuizQuestion } from '../lib/quiz'
  import { pop, shake } from '../lib/motion'
  import { navigate } from '../lib/router.svelte'
  import { gradeShadeLabel, pct } from '../lib/util'

  const SESSION = 15
  const UNDO_MS = 5000

  let queue = $state<string[]>([])
  let index = $state(0)
  let question = $state<QuizQuestion>()
  let selected = $state<number | null>(null)
  let answered = $state(false)
  let asked = $state(0)
  let correct = $state(0)
  let done = $state(false)
  let started = Date.now()
  let optionsEl = $state<HTMLElement>()
  let announce = $state('') // sr-only live-region text: correctness + answer/shade
  let reverse = $state(false) // selected direction for upcoming questions (the toggle)
  let qReverse = $state(false) // direction the *current* question is locked to (set when it's built)

  let showUndo = $state(false) // the "Graded — Undo" toast window
  let undoTimer: ReturnType<typeof setTimeout> | undefined
  let lastCorrect = false // whether the graded answer was right (to revert the local tally)
  let lastQIndex = 0 // queue index of the just-graded question (so undo can jump back after advancing)

  const currentId = $derived(queue[index])

  function setQuestion() {
    const sign = currentId ? SIGN_BY_ID.get(currentId) : undefined
    question = sign ? buildQuestion(sign, activeSigns(), SIGN_BY_ID) : undefined
    qReverse = reverse // lock this question's direction; toggling later won't flip it
    selected = null
    answered = false
    announce = '' // reset so the next result re-announces even if it repeats the wording
    started = Date.now()
  }

  function build() {
    const focus = takeQuizFocus()
    if (focus.length) {
      queue = focus.slice(0, SESSION)
    } else {
      // No reviewCap here: that cap is a Study-session comfort limit. Quiz has its
      // own SESSION cap, and applying reviewCap could shrink the quiz below it.
      const q = buildStudyQueue(activeSigns(), store.reviews, store.settings.newPerDay, Date.now(), store.settings.shuffleCategories)
      queue = q.ids.slice(0, SESSION)
    }
    index = 0
    asked = 0
    correct = 0
    done = false
    hideUndo()
    setQuestion()
  }

  async function choose(i: number) {
    if (answered || !question) return
    selected = i
    answered = true
    asked += 1
    const isRight = i === question.answerIndex
    if (isRight) correct += 1
    const responseMs = Date.now() - started
    const chosenWrongId = isRight ? undefined : question.options[i].id
    const g = gradeQuiz(question.sign.id, isRight, responseMs, chosenWrongId)
    // announce correct/incorrect + the right answer (or inferred shade) to AT (WCAG 4.1.3)
    announce =
      (isRight
        ? `Correct — marked ${gradeShadeLabel(g)}.`
        : `Not quite — the answer is ${question.sign.caption}.`) + ' Press U to undo.'
    lastCorrect = isRight
    lastQIndex = index
    flashUndo()
    await tick()
    // bail if the question was reset (e.g. undo) during the await, so we never
    // animate the wrong/re-rendered option
    if (!answered || selected !== i || !optionsEl) return
    if (isRight) pop(optionsEl.children[i] as HTMLElement)
    else shake(optionsEl.children[i] as HTMLElement)
  }

  function next() {
    // Keep the undo toast alive across advancing (its own 5s timer, or the next
    // grade, dismisses it) so the post-grade undo window matches Study's — undo()
    // jumps back to lastQIndex rather than relying on still being on the question.
    if (index + 1 >= queue.length) {
      done = true
      return
    }
    index += 1
    setQuestion()
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
    hideUndo()
    if (!undoLastGrade()) return
    // jump back to the graded question (it may have been advanced past) and re-open
    // it for another answer — also recovers it from the session-complete screen.
    index = lastQIndex
    done = false
    setQuestion() // resets selected/answered/announce/started for a fresh attempt
    asked = Math.max(0, asked - 1)
    if (lastCorrect) correct = Math.max(0, correct - 1)
    announce = 'Grade undone — choose again.'
    // restore focus to the options so keyboard/SR users keep their place (Study does the same)
    await tick()
    optionsEl?.querySelector<HTMLButtonElement>('.option')?.focus()
  }

  // Choose the quiz direction. It applies to the *next* question, never the one on
  // screen: re-presenting the current question in the opposite direction would turn
  // the sign (or caption) you just saw into one of the four options — i.e. reveal the
  // answer. The current question stays locked to qReverse until it's answered/advanced.
  function setReverse(r: boolean) {
    if (reverse === r) return
    reverse = r
  }

  // The accessible name for an option. Forward mode leaves it to the visible caption;
  // reverse mode (image options) needs the caption spoken — and, once answered, the
  // correct/wrong result too, since the check/✗ glyph alone isn't conveyed to AT.
  function optLabel(opt: { caption: string }, i: number): string | undefined {
    if (!qReverse) return undefined
    if (!answered || !question) return opt.caption
    if (i === question.answerIndex) return `${opt.caption}, correct answer`
    if (i === selected) return `${opt.caption}, your answer, incorrect`
    return opt.caption
  }

  function onKey(e: KeyboardEvent) {
    if (showUndo && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault()
      undo()
      return
    }
    if (done) return
    if (!answered && question && /^[1-4]$/.test(e.key)) {
      const i = Number(e.key) - 1
      if (i < question.options.length) choose(i)
    } else if (answered && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      next()
    }
  }

  // a wrong choice that is a known look-alike is worth calling out
  const confusionNote = $derived.by(() => {
    if (!answered || selected == null || !question) return ''
    if (selected === question.answerIndex) return ''
    const chosen = question.options[selected]
    return question.sign.confusedWith.includes(chosen.id)
      ? `Easy to mix up with “${chosen.caption}”.`
      : ''
  })

  onMount(() => {
    build()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearTimeout(undoTimer)
    }
  })
</script>

<section class="quiz">
  <p class="sr-only" aria-live="polite" role="status">{announce}</p>
  {#if showUndo}<UndoToast onUndo={undo} />{/if}
  {#if done}
    <div class="result">
      <span class="result__score t-num">{pct(asked ? correct / asked : null)}</span>
      <h1 class="t-title" id="view-heading" tabindex="-1">
        {correct} of {asked} correct
      </h1>
      <p class="t-body result__sub">Quiz answers feed straight into your schedule and report.</p>
      <div class="result__actions">
        <button class="btn btn--primary" onclick={build}>New quiz</button>
        <button class="btn btn--ghost" onclick={() => navigate('report')}>See report</button>
      </div>
    </div>
  {:else if question}
    <header class="quiz__head">
      <h1 class="sr-only" id="view-heading" tabindex="-1">Quiz</h1>
      <span class="t-caption">{qReverse ? 'Which sign means this?' : 'Which sign is this?'}</span>
      <span class="quiz__pos t-num">{index + 1} / {queue.length}</span>
    </header>

    <div class="quiz__mode" role="group" aria-label="Quiz direction (applies to the next question)">
      <button
        type="button"
        class="quiz__mode-btn"
        class:is-active={!reverse}
        aria-pressed={!reverse}
        onclick={() => setReverse(false)}
      >Name the sign</button>
      <button
        type="button"
        class="quiz__mode-btn"
        class:is-active={reverse}
        aria-pressed={reverse}
        onclick={() => setReverse(true)}
      >Spot the sign</button>
    </div>

    {#if qReverse}
      <div class="quiz__prompt">
        <span class="quiz__prompt-cap t-title">{question.sign.caption}</span>
      </div>
    {:else}
      <div class="quiz__sign">
        <SignPlate sign={question.sign} />
      </div>
    {/if}

    <div class="options" class:options--grid={qReverse} bind:this={optionsEl}>
      {#each question.options as opt, i (opt.id)}
        <button
          class="option"
          class:option--img={qReverse}
          class:is-correct={answered && i === question.answerIndex}
          class:is-wrong={answered && i === selected && i !== question.answerIndex}
          class:is-dim={answered && i !== question.answerIndex && i !== selected}
          disabled={answered}
          aria-label={optLabel(opt, i)}
          onclick={() => choose(i)}
        >
          <span class="option__key" aria-hidden="true">{i + 1}</span>
          {#if qReverse}
            <div class="option__plate"><SignPlate sign={opt} tag={false} /></div>
          {:else}
            <span class="option__text">{opt.caption}</span>
          {/if}
          {#if answered && i === question.answerIndex}
            <span class="option__mark"><Icon name="check" size={18} /></span>
          {:else if answered && i === selected}
            <span class="option__mark"><Icon name="x" size={18} /></span>
          {/if}
        </button>
      {/each}
    </div>

    <div class="quiz__foot">
      {#if answered}
        <p class="feedback" class:feedback--ok={selected === question.answerIndex}>
          {selected === question.answerIndex ? 'Correct.' : 'Not quite.'}
          {#if confusionNote}<span class="feedback__note">{confusionNote}</span>{/if}
        </p>
        <button class="btn btn--primary" onclick={next}>
          {index + 1 >= queue.length ? 'Finish' : 'Next'}
          <Icon name="arrow-right" size={18} />
        </button>
      {:else}
        <p class="t-caption quiz__hint">{qReverse ? 'Tap the sign, or press 1–4' : 'Tap an answer, or press 1–4'}</p>
      {/if}
    </div>
  {:else}
    <div class="result">
      <span class="empty__check"><Icon name="check" size={26} /></span>
      <h1 class="t-title" id="view-heading" tabindex="-1">All caught up</h1>
      <p class="t-body result__sub">
        Nothing to quiz right now. Come back when reviews are due, or browse the reference.
      </p>
      <div class="result__actions">
        <button class="btn btn--primary" onclick={() => navigate('browse')}>Browse the reference</button>
        <button class="btn btn--ghost" onclick={() => navigate('report')}>See report</button>
      </div>
    </div>
  {/if}
</section>

<style>
  .quiz {
    display: flex;
    flex-direction: column;
    gap: var(--s-4);
    max-width: 560px;
    margin: 0 auto;
  }
  .quiz__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  .quiz__pos {
    font-size: var(--fs-caption);
    color: var(--text-faint);
  }
  .quiz__sign {
    width: 100%;
    max-width: 200px;
    margin: 0 auto;
  }

  .quiz__mode {
    display: inline-flex;
    align-self: center;
    gap: 2px;
    padding: 3px;
    background: var(--surface-sunken);
    border-radius: var(--r-pill);
  }
  .quiz__mode-btn {
    min-height: 36px;
    padding: 0 var(--s-4);
    border-radius: var(--r-pill);
    font-size: var(--fs-caption);
    font-weight: var(--fw-medium);
    color: var(--text-muted);
  }
  .quiz__mode-btn.is-active {
    background: var(--surface-raised);
    color: var(--text);
    box-shadow: var(--shadow-1);
  }
  .quiz__mode-btn:disabled {
    cursor: default;
  }

  .quiz__prompt {
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    min-height: 120px;
    padding: var(--s-4) var(--s-3);
  }
  .quiz__prompt-cap {
    font-size: var(--fs-title);
  }

  .options {
    display: grid;
    gap: var(--s-2);
  }
  .options--grid {
    grid-template-columns: 1fr 1fr;
    gap: var(--s-3);
  }
  .option {
    display: flex;
    align-items: center;
    gap: var(--s-3);
    width: 100%;
    padding: var(--s-3) var(--s-4);
    min-height: 54px;
    text-align: left;
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    background: var(--surface);
    color: var(--text);
    transition:
      background var(--dur-fast) var(--ease-standard),
      border-color var(--dur-fast) var(--ease-standard);
  }
  .option:hover:not(:disabled) {
    background: var(--surface-hover);
    border-color: var(--border-strong);
  }
  .option__key {
    flex: none;
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    font-family: var(--font-mono);
    font-size: var(--fs-caption);
    color: var(--text-muted);
    border: 1px solid var(--hairline);
    border-radius: var(--r-xs);
  }
  .option__text {
    flex: 1;
    font-size: var(--fs-callout);
    font-weight: var(--fw-medium);
  }
  .option__mark {
    flex: none;
    display: grid;
    place-items: center;
  }

  /* "Spot the sign": each option is a sign image in a 2×2 grid. */
  .option--img {
    flex-direction: column;
    align-items: stretch;
    gap: var(--s-2);
    padding: var(--s-3);
    min-height: 0;
    position: relative;
  }
  .option--img .option__key {
    position: absolute;
    top: var(--s-2);
    left: var(--s-2);
    z-index: 1;
    background: var(--surface);
  }
  .option--img .option__mark {
    position: absolute;
    top: var(--s-2);
    right: var(--s-2);
    z-index: 1;
    width: 24px;
    height: 24px;
    border-radius: var(--r-pill);
    /* opaque chip so the check/✗ stays legible sitting over the sign artwork */
    background: var(--surface);
  }
  .option__plate {
    width: 100%;
    max-width: 140px;
    margin: 0 auto;
  }
  .option.is-correct {
    border-color: var(--grade-good);
    background: color-mix(in srgb, var(--grade-good) 14%, transparent);
    color: var(--text);
  }
  .option.is-correct .option__mark {
    color: var(--grade-good);
  }
  .option.is-wrong {
    border-color: var(--grade-again);
    background: color-mix(in srgb, var(--grade-again) 14%, transparent);
  }
  .option.is-wrong .option__mark {
    color: var(--grade-again);
  }
  .option.is-dim {
    opacity: 0.55;
  }
  .option:disabled {
    cursor: default;
  }

  .quiz__foot {
    min-height: 70px;
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    align-items: flex-start;
  }
  .quiz__hint {
    margin-top: var(--s-2);
  }
  .feedback {
    font-size: var(--fs-callout);
    font-weight: var(--fw-semibold);
    color: var(--grade-again);
    display: flex;
    flex-wrap: wrap;
    gap: var(--s-2);
    align-items: baseline;
  }
  .feedback--ok {
    color: var(--grade-good);
  }
  .feedback__note {
    font-weight: var(--fw-regular);
    color: var(--text-muted);
  }
  .quiz__foot .btn {
    align-self: stretch;
  }
  @media (min-width: 560px) {
    .quiz__foot .btn {
      align-self: flex-end;
    }
  }

  .result {
    margin: auto;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--s-2);
    max-width: 36ch;
    padding-top: var(--s-7);
  }
  .result__score {
    font-size: var(--fs-stat);
    font-weight: var(--fw-semibold);
    color: var(--accent-ink);
  }
  .result__sub {
    color: var(--text-secondary);
  }
  .result__actions {
    display: flex;
    gap: var(--s-2);
    margin-top: var(--s-4);
    flex-wrap: wrap;
    justify-content: center;
  }
  .empty__check {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: var(--r-pill);
    color: var(--grade-good);
    background: color-mix(in srgb, var(--grade-good) 14%, transparent);
    margin-bottom: var(--s-2);
  }
</style>
