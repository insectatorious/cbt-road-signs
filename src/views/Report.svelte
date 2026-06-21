<script lang="ts">
  import { onMount } from 'svelte'
  import StatCard from '../components/StatCard.svelte'
  import Sparkline from '../components/Sparkline.svelte'
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
    sentenceForPlan,
    type RankedCard,
  } from '../lib/stats'
  import { navigate } from '../lib/router.svelte'
  import { pct, humanInterval } from '../lib/util'
  import { CATEGORY_META } from '../lib/types'

  const now = Date.now()
  const deck = activeSigns()
  const report = buildReport(deck, store.reviews, store.sessions, now)
  const ranks = rankCards(store.reviews, 6)
  const spark = store.sessions.slice(-14).map((s) => s.reviewed)
  const hasData = report.totalReviews > 0

  // the spaced-repetition plan: forward forecast + learned state (all derived,
  // computed once at render over the in-scope deck — same deck as the report)
  const forecast = buildForecast(deck, store.reviews, now)
  const forecastTotal = forecast.buckets.reduce((a, b) => a + b, 0)
  const stages = classifyStages(deck, store.reviews)
  const stagesTotal = stages.newToStart + stages.learning + stages.settling + stages.lockedIn
  const stageSegments = [
    { key: 'new', label: 'New', count: stages.newToStart },
    { key: 'learning', label: 'Learning', count: stages.learning },
    { key: 'settling', label: 'Settling', count: stages.settling },
    { key: 'good', label: 'Locked in', count: stages.lockedIn },
  ]
  const intervals = intervalHistogram(deck, store.reviews)
  const maxInterval = Math.max(1, ...intervals.map((b) => b.count))
  const planSentences = sentenceForPlan(forecast, stages, report)

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
    <p class="t-caption">How your revision is going.</p>
  </header>

  {#if !hasData}
    <div class="empty">
      <span class="empty__icon"><Icon name="chart" size={24} /></span>
      <p class="t-body">Study or quiz a few signs and your performance shows up here.</p>
      <button class="btn btn--primary" onclick={() => navigate('study')}>Start studying</button>
    </div>
  {:else}
    <div class="stats">
      <StatCard label="Recall accuracy" value={(report.overallAccuracy ?? 0) * 100} format={(n) => `${Math.round(n)}%`} accent />
      <StatCard label="30-day retention" value={(report.retention ?? 0) * 100} format={(n) => `${Math.round(n)}%`} />
      <StatCard label="Mastered" value={report.mastered} sub={`of ${report.total} signs`} />
      <StatCard label="Due today" value={report.dueToday} sub="to review" />
      <StatCard label="Day streak" value={report.studyStreakDays} sub={report.studyStreakDays === 1 ? 'day' : 'days'} />
      <StatCard label="Seen" value={report.introduced} sub={`of ${report.total}`} />
    </div>

    <!-- CBT-ready gauge -->
    <div class="panel">
      <div class="panel__row">
        <span class="t-micro">Core signs mastered</span>
        <span class="t-num panel__val">{pct(report.coreMasteredPct)}</span>
      </div>
      <div class="bar bar--lg">
        <div class="bar__fill bar__fill--good" style="transform:scaleX({shown ? report.coreMasteredPct : 0})"></div>
      </div>
      <p class="t-caption">A rough practice-readiness gauge — not an official CBT result.</p>
    </div>

    {#if spark.length > 1}
      <div class="panel">
        <div class="panel__row">
          <span class="t-micro">Recent activity</span>
          <span class="t-caption">last {spark.length} sessions</span>
        </div>
        <Sparkline points={spark} />
      </div>
    {/if}

    <!-- Spaced-repetition plan: the forward schedule + what's been learnt -->
    <div class="block">
      <h2 class="t-heading">Your learning plan</h2>
      <p class="t-body lede">{planSentences.join(' ')}</p>
    </div>

    <!-- THE PLAN — forward due-date forecast -->
    <div class="panel">
      <div class="panel__row">
        <span class="t-micro">Upcoming reviews</span>
        {#if forecast.buckets[0] > 0}
          <button class="btn btn--ghost btn--sm" onclick={() => navigate('study')}>
            <Icon name="target" size={16} /> Review now
          </button>
        {/if}
      </div>
      {#if forecastTotal > 0}
        <Forecast buckets={forecast.buckets} {now} {shown} />
      {/if}
      {#if forecast.next7 > 0}
        <p class="t-caption">
          {forecast.next7} due in the next 7 days{#if forecast.next30 > forecast.next7} ·
            {forecast.next30} in the next 30{/if}
        </p>
      {:else if forecast.next30 > 0}
        <p class="t-caption">{forecast.next30} due in the next 30 days</p>
      {:else if forecastTotal === 0 && forecast.overflow === 0}
        <p class="t-caption">You're all caught up — nothing scheduled.</p>
      {:else if forecastTotal === 0}
        <p class="t-caption">Nothing due in the next 30 days.</p>
      {/if}
    </div>

    <!-- WHAT IT'S LEARNT — learning-stage breakdown -->
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
        long-term memory.
      </p>
    </div>

    <!-- WHAT IT'S LEARNT — memory-strength (interval) distribution -->
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

    <!-- Per-category -->
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
            <span class="cat__sub t-caption">{c.seen}/{c.total} seen · {c.mastered} mastered</span>
          </li>
        {/each}
      </ul>
    </div>

    <!-- Needs work -->
    {#if ranks.worst.length}
      <div class="block">
        <div class="block__head">
          <h2 class="t-heading">Needs work</h2>
          <button class="btn btn--ghost btn--sm" onclick={() => drill(ranks.worst)}>
            <Icon name="target" size={16} /> Drill these
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
                    <span class="row__note">mixed up with {SIGN_BY_ID.get(c.topConfusion)!.caption}</span>
                  {/if}
                </span>
                <span class="row__stat row__stat--poor t-num">{pct(c.accuracy)}</span>
              </li>
            {/if}
          {/each}
        </ul>
      </div>
    {/if}

    <!-- Strongest -->
    {#if ranks.best.length}
      <div class="block">
        <h2 class="t-heading">Strongest</h2>
        <ul class="rows">
          {#each ranks.best as c (c.id)}
            {@const sign = SIGN_BY_ID.get(c.id)}
            {#if sign}
              <li class="row">
                <span class="row__chip"><SignPlate {sign} pad={false} /></span>
                <span class="row__main"><span class="row__cap">{sign.caption}</span></span>
                <span class="row__stat row__stat--good t-num">{pct(c.accuracy)}</span>
              </li>
            {/if}
          {/each}
        </ul>
      </div>
    {/if}
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

  .stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--s-3);
  }
  @media (min-width: 600px) {
    .stats {
      grid-template-columns: repeat(3, 1fr);
    }
  }

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

  .lede {
    color: var(--text-secondary);
    max-width: 60ch;
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
  .row__stat--good {
    color: var(--stat-good);
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--s-3);
    text-align: center;
    max-width: 40ch;
    min-height: 56vh;
    margin: 0 auto;
    padding: var(--s-6) var(--s-4);
    color: var(--text-secondary);
  }
  .empty__icon {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: var(--r-pill);
    color: var(--text-muted);
    background: var(--surface-sunken);
  }
</style>
