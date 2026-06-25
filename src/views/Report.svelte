<script lang="ts">
  import { onMount } from 'svelte'
  import Forecast from '../components/Forecast.svelte'
  import SignPlate from '../components/SignPlate.svelte'
  import Icon from '../components/Icon.svelte'
  import { store, activeSigns, setQuizFocus, SIGN_BY_ID } from '../lib/store.svelte'
  import {
    buildReport,
    rankCards,
    buildForecast,
    classifyStages,
    intervalHistogram,
    recallReadiness,
    daysSinceStart,
    accuracyVerdict,
    coachAction,
    windowedRetention,
    RETENTION_WINDOW_DAYS,
    RETENTION_MIN_EVENTS,
    type RankedCard,
  } from '../lib/stats'
  import { navigate } from '../lib/router.svelte'
  import { pct, humanInterval, todayStr } from '../lib/util'
  import { CATEGORY_META } from '../lib/types'

  const now = Date.now()
  const deck = activeSigns()
  const report = buildReport(deck, store.reviews, store.sessions, now)
  const forecast = buildForecast(deck, store.reviews, now)
  const stages = classifyStages(deck, store.reviews)
  const ranks = rankCards(store.reviews, 3)
  const readiness = recallReadiness(deck, store.reviews)
  const days = daysSinceStart(store.createdAt, store.sessions, now)
  const hasData = report.totalReviews > 0

  // today's remaining new-card budget — so a "learn new" action never overshoots.
  // Guard newSeen (a malformed backup could leave it non-numeric → NaN budget).
  const last = store.sessions[store.sessions.length - 1]
  const newSeenToday =
    last && last.date === todayStr(now) && Number.isFinite(last.newSeen) ? last.newSeen : 0
  const newRemainingToday = Math.max(0, store.settings.newPerDay - newSeenToday)

  const action = coachAction({
    introduced: report.introduced,
    dueNow: forecast.buckets[0] ?? 0,
    tomorrow: forecast.buckets[1] ?? 0,
    next7: forecast.next7,
    newAvailable: stages.newToStart,
    newRemainingToday,
  })
  const EYEBROW = {
    start: 'Get started',
    review: 'Do this now',
    learn: 'Next up',
    'caught-up': 'All caught up',
  } as const
  const CTA_ICON = { review: 'target', learn: 'layers', 'caught-up': 'search', start: 'layers' } as const

  // gauge: how many in-scope CORE signs the learner can recall unaided right now
  const readyPct = readiness.coreTotal ? readiness.ready / readiness.coreTotal : 0

  // honest, self-dated retention — label never lies. "Memory over time" only means
  // something once reviews are spread across days, so gate on ~a week of history AND
  // enough events (this keeps the "about a week" empty-state copy below truthful).
  const retentionWindow = Math.min(RETENTION_WINDOW_DAYS, days)
  const retentionValue =
    days >= 7 ? windowedRetention(store.reviews, now, retentionWindow, RETENTION_MIN_EVENTS) : null
  const retentionLabel =
    days >= RETENTION_WINDOW_DAYS ? 'the last 30 days' : `your ${days} day${days === 1 ? '' : 's'}`

  // collapsed-disclosure data (learning stages, memory strength, categories, forecast)
  const stagesTotal = stages.newToStart + stages.learning + stages.settling + stages.lockedIn
  const stageSegments = [
    { key: 'new', label: 'New', count: stages.newToStart },
    { key: 'learning', label: 'Learning', count: stages.learning },
    { key: 'settling', label: 'Settling', count: stages.settling },
    { key: 'good', label: 'Locked in', count: stages.lockedIn },
  ]
  const intervals = intervalHistogram(deck, store.reviews)
  const maxInterval = Math.max(1, ...intervals.map((b) => b.count))
  const forecastTotal = forecast.buckets.reduce((a, b) => a + b, 0)

  function barTone(acc: number | null): string {
    if (acc == null) return 'neutral'
    if (acc >= 0.8) return 'good'
    if (acc < 0.5) return 'poor'
    return 'neutral'
  }

  function drill(cards: RankedCard[]) {
    setQuizFocus(cards.map((c) => c.id))
    navigate('quiz')
  }

  // bars grow from 0 → value via CSS transition once mounted
  let shown = $state(false)
  onMount(() => {
    requestAnimationFrame(() => (shown = true))
  })
</script>

<section class="report">
  <header class="report__head">
    <h1 class="t-display" id="view-heading" tabindex="-1">Report</h1>
    <p class="t-caption">
      {#if hasData}
        Day {days} of revising · {report.totalReviews}
        {report.totalReviews === 1 ? 'review' : 'reviews'}
      {:else}
        Your road-sign coach
      {/if}
    </p>
  </header>

  <!-- THE ONE THING TO DO NOW -->
  <div class="coach coach--{action.mode}">
    <span class="t-micro coach__eyebrow">{EYEBROW[action.mode]}</span>
    <h2 class="t-title coach__head">{action.heading}</h2>
    <p class="coach__sub">{action.sub}</p>
    {#if action.cta}
      <button class="btn btn--primary coach__cta" onclick={() => navigate(action.cta!.route)}>
        <Icon name={CTA_ICON[action.mode]} size={18} />
        {action.cta.label}
      </button>
    {/if}
    {#if action.forward}
      <p class="coach__forward t-caption">{action.forward}</p>
    {/if}
  </div>

  {#if hasData}
    <!-- THE ONE NUMBER: recall readiness over the core set -->
    <div class="panel">
      <div class="panel__row">
        <span class="t-micro">Core signs you can recall</span>
        <span class="t-num panel__val">{readiness.ready} / {readiness.coreTotal}</span>
      </div>
      <div class="bar bar--lg">
        <div class="bar__fill bar__fill--good" style="transform:scaleX({shown ? readyPct : 0})"></div>
      </div>
      {#if readiness.ready === 0}
        <p class="t-caption">
          None you can recall unaided just yet — this climbs fast as signs settle in. Keep going.
        </p>
      {:else}
        <p class="t-caption">
          You can recall {readiness.ready} of the {readiness.coreTotal} core signs without help. The
          closer to all {readiness.coreTotal}, the more confident you'll be on the road.
        </p>
      {/if}
      <p class="t-caption disclaimer">A rough practice gauge — not an official CBT result.</p>
    </div>

    <!-- THE SECOND ACTION: shore up the weakest signs -->
    {#if ranks.worst.length}
      <div class="block">
        <div class="block__head">
          <h2 class="t-heading">Worth a closer look</h2>
          <button class="btn btn--ghost btn--sm" onclick={() => drill(ranks.worst)}>
            <Icon name="target" size={16} /> Drill these {ranks.worst.length}
          </button>
        </div>
        <ul class="rows">
          {#each ranks.worst as c (c.id)}
            {@const sign = SIGN_BY_ID.get(c.id)}
            {#if sign}
              <li class="row">
                <span class="row__chip"><SignPlate {sign} pad={false} /></span>
                <span class="row__main">
                  <span class="row__cap">{sign.caption}</span>
                  {#if c.topConfusion && SIGN_BY_ID.get(c.topConfusion)}
                    <span class="row__note"
                      >mixed up with {SIGN_BY_ID.get(c.topConfusion)!.caption}</span
                    >
                  {/if}
                </span>
                <span class="row__stat row__stat--poor t-num">{pct(c.accuracy)}</span>
              </li>
            {/if}
          {/each}
        </ul>
      </div>
    {/if}

    <!-- EVERYTHING ELSE: collapsed by default, opens itself once there's a week of history -->
    <details class="details" open={days >= 7}>
      <summary class="details__summary">
        <span class="details__chev"><Icon name="chevron" size={16} /></span>
        <span class="details__title">Details &amp; progress</span>
        <span class="details__hint t-caption">accuracy · memory · categories</span>
      </summary>

      <div class="details__body">
        {#if report.overallAccuracy != null}
          <div class="panel">
            <div class="panel__row">
              <span class="t-micro">Overall accuracy</span>
              <span class="t-num panel__val">{pct(report.overallAccuracy)}</span>
            </div>
            <p class="t-caption">
              {accuracyVerdict(report.overallAccuracy, days)} · you've met {report.introduced} of {report.total}
              signs.
            </p>
          </div>
        {/if}

        <div class="panel">
          <span class="t-micro">Memory over time</span>
          {#if retentionValue != null}
            <p class="t-caption">
              <strong class="t-num">{pct(retentionValue)}</strong> of your reviews over {retentionLabel}
              were recalled on sight.
            </p>
          {:else}
            <p class="t-caption">
              Building up — a memory-retention score appears once you have about a week of reviews
              behind you.
            </p>
          {/if}
        </div>

        <!-- learning stages -->
        <div class="panel">
          <span class="t-micro">Learning stages</span>
          <div class="bar bar--lg segbar">
            {#each stageSegments as seg (seg.key)}
              {#if seg.count > 0}
                <div
                  class="segbar__seg segbar__seg--{seg.key}"
                  style="width:{shown ? (seg.count / stagesTotal) * 100 : 0}%"
                ></div>
              {/if}
            {/each}
          </div>
          <ul class="legend">
            {#each stageSegments as seg (seg.key)}
              <li class="legend__item">
                <span class="legend__dot legend__dot--{seg.key}"></span>
                <span class="t-caption">{seg.label}</span>
                <span class="t-num legend__n">{seg.count}</span>
              </li>
            {/each}
          </ul>
          <p class="t-caption">
            Signs climb these stages as you remember them for longer. “Locked in” means safely in
            long-term memory — that takes a few weeks, so it stays small early on.
          </p>
        </div>

        <!-- memory strength: interval distribution -->
        {#if stages.introducedTotal > 0}
          <div class="block">
            <div class="block__head">
              <h2 class="t-heading">Memory strength</h2>
              <span class="t-caption">avg. gap {humanInterval(Math.round(stages.avgGapDays))}</span>
            </div>
            <ul class="cats">
              {#each intervals as bkt (bkt.label)}
                <li class="cat">
                  <div class="cat__top">
                    <span class="cat__name">{bkt.label}</span>
                    <span class="cat__meta t-num">{bkt.count}</span>
                  </div>
                  <div class="bar">
                    <div
                      class="bar__fill bar__fill--good"
                      style="transform:scaleX({shown ? bkt.count / maxInterval : 0})"
                    ></div>
                  </div>
                </li>
              {/each}
            </ul>
          </div>
        {/if}

        <!-- forward schedule -->
        {#if forecastTotal > 0}
          <div class="panel">
            <span class="t-micro">When reviews come due</span>
            <Forecast buckets={forecast.buckets} {now} {shown} />
          </div>
        {/if}

        <!-- per-category accuracy -->
        <div class="block">
          <h2 class="t-heading">By category</h2>
          <ul class="cats">
            {#each report.perCategory.filter((c) => c.total > 0) as c (c.category)}
              <li class="cat">
                <div class="cat__top">
                  <span class="cat__name">{CATEGORY_META[c.category].label}</span>
                  <span class="cat__meta t-num">{c.accuracy == null ? '—' : pct(c.accuracy)}</span>
                </div>
                <div class="bar">
                  <div
                    class="bar__fill bar__fill--{barTone(c.accuracy)}"
                    style="transform:scaleX({shown ? (c.accuracy ?? 0) : 0})"
                  ></div>
                </div>
                <span class="cat__sub t-caption"
                  >{c.seen}/{c.total} seen · {c.mastered} mastered</span
                >
              </li>
            {/each}
          </ul>
        </div>
      </div>
    </details>
  {:else}
    <p class="muted t-caption">Your progress, memory and schedule appear here as you study.</p>
  {/if}
</section>

<style>
  .report {
    display: flex;
    flex-direction: column;
    gap: var(--s-5);
    max-width: 720px;
    margin: 0 auto;
  }
  .report__head h1 {
    margin-bottom: 2px;
  }

  /* ---- the coach action card (the hero) ---- */
  .coach {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    padding: var(--s-5);
    border: 1px solid var(--border);
    border-radius: var(--r-lg);
    background: var(--surface);
  }
  .coach--review {
    border-color: color-mix(in srgb, var(--amber) 50%, var(--border));
    background: var(--amber-tint);
  }
  .coach__eyebrow {
    color: var(--text-muted);
  }
  .coach--review .coach__eyebrow {
    color: var(--amber-text);
  }
  .coach__head {
    margin-top: 2px;
  }
  .coach__sub {
    color: var(--text-secondary);
    max-width: 48ch;
  }
  .coach__cta {
    align-self: flex-start;
    margin-top: var(--s-3);
    gap: var(--s-2);
  }
  .coach__forward {
    margin-top: var(--s-1);
    color: var(--text-muted);
  }

  .muted {
    color: var(--text-muted);
  }

  /* ---- shared panels / bars ---- */
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    padding: var(--s-4);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    background: var(--surface);
  }
  .panel__row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  .panel__val {
    font-size: var(--fs-heading);
    font-weight: var(--fw-semibold);
  }
  .disclaimer {
    color: var(--text-faint);
  }

  .bar {
    height: 8px;
    background: var(--surface-sunken);
    border-radius: var(--r-pill);
    overflow: hidden;
  }
  .bar--lg {
    height: 10px;
  }
  .bar__fill {
    height: 100%;
    border-radius: var(--r-pill);
    transform-origin: left center;
    background: var(--stat-neutral);
    transition: transform 0.6s var(--ease-standard);
  }
  .bar__fill--good {
    background: var(--stat-good);
  }
  .bar__fill--poor {
    background: var(--stat-poor);
  }
  .bar__fill--neutral {
    background: var(--stone-50);
  }

  /* segmented learning-stage bar (shares the .bar track) */
  .segbar {
    display: flex;
  }
  .segbar__seg {
    height: 100%;
    transition: width 0.6s var(--ease-standard);
  }
  .segbar__seg--new {
    background: var(--stone-50);
  }
  .segbar__seg--learning {
    background: var(--amber);
  }
  .segbar__seg--settling {
    background: var(--stat-good);
    opacity: 0.5;
  }
  .segbar__seg--good {
    background: var(--stat-good);
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s-2) var(--s-4);
  }
  .legend__item {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .legend__dot {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: var(--r-pill);
  }
  .legend__dot--new {
    background: var(--stone-50);
  }
  .legend__dot--learning {
    background: var(--amber);
  }
  .legend__dot--settling {
    background: var(--stat-good);
    opacity: 0.5;
  }
  .legend__dot--good {
    background: var(--stat-good);
  }
  .legend__n {
    font-weight: var(--fw-semibold);
  }

  /* ---- collapsed disclosure ---- */
  .details {
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    background: var(--surface);
  }
  .details__summary {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    padding: var(--s-4);
    cursor: pointer;
    list-style: none;
    user-select: none;
  }
  .details__summary::-webkit-details-marker {
    display: none;
  }
  .details__chev {
    display: grid;
    place-items: center;
    color: var(--text-muted);
    transition: transform var(--dur-base) var(--ease-standard);
  }
  .details[open] .details__chev {
    transform: rotate(90deg);
  }
  .details__title {
    font-size: var(--fs-callout);
    font-weight: var(--fw-medium);
  }
  .details__hint {
    margin-left: auto;
    color: var(--text-faint);
  }
  .details__summary:hover .details__title {
    color: var(--text);
  }
  .details__body {
    display: flex;
    flex-direction: column;
    gap: var(--s-5);
    padding: 0 var(--s-4) var(--s-4);
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
  }
  .block__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .btn--sm {
    min-height: 36px;
    padding: var(--s-2) var(--s-3);
    font-size: var(--fs-caption);
  }

  .cats {
    display: flex;
    flex-direction: column;
    gap: var(--s-4);
  }
  .cat {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .cat__top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  .cat__name {
    font-size: var(--fs-callout);
    font-weight: var(--fw-medium);
  }
  .cat__meta {
    font-size: var(--fs-caption);
    color: var(--text-muted);
  }
  .cat__sub {
    color: var(--text-faint);
  }

  .rows {
    display: flex;
    flex-direction: column;
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--s-3);
    padding: var(--s-2) 0;
    border-top: 1px solid var(--divider);
  }
  .row:first-child {
    border-top: none;
  }
  .row__chip {
    flex: none;
    width: 44px;
  }
  .row__main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .row__cap {
    font-size: var(--fs-callout);
    font-weight: var(--fw-medium);
  }
  .row__note {
    font-size: var(--fs-caption);
    color: var(--text-muted);
  }
  .row__stat {
    flex: none;
    font-size: var(--fs-callout);
    font-weight: var(--fw-semibold);
  }
  .row__stat--poor {
    color: var(--stat-poor);
  }

  @media (prefers-reduced-motion: reduce) {
    .bar__fill,
    .segbar__seg,
    .details__chev {
      transition: none;
    }
  }
</style>
