<script lang="ts">
  import SignPlate from '../components/SignPlate.svelte'
  import SignDetail from '../components/SignDetail.svelte'
  import Icon from '../components/Icon.svelte'
  import BookmarkButton from '../components/BookmarkButton.svelte'
  import { SIGNS, store } from '../lib/store.svelte'
  import { searchSigns } from '../lib/search'
  import { sortReference, type ReferenceSort } from '../lib/deck'
  import { cardStage, isStruggling } from '../lib/stats'
  import { CATEGORY_META, type SignCategory, type SignDefinition, type Tier } from '../lib/types'

  // The reference shows the COMPLETE set regardless of the study scope slider, but
  // still respects the motorway opt-in (which is off by default).
  const reference = $derived(
    SIGNS.filter((s) => s.category !== 'motorway' || store.settings.includeMotorway),
  )

  const categories = $derived(
    (Object.keys(CATEGORY_META) as SignCategory[])
      .filter((c) => c !== 'motorway' || store.settings.includeMotorway)
      .sort((a, b) => CATEGORY_META[a].order - CATEGORY_META[b].order),
  )

  let query = $state('')
  let cat = $state<SignCategory | 'all' | 'bookmarked'>('all')
  let tier = $state<'all' | Tier>('all')
  let mastery = $state<'all' | 'new' | 'learning' | 'settling' | 'mastered' | 'struggling'>('all')
  let sort = $state<ReferenceSort>('default')
  let selectedId = $state<string | null>(null)

  // saved signs that are in scope to show here (a saved motorway sign is hidden
  // while that module is off — surfaced as a notice, never silently dropped)
  const savedTotal = $derived(store.bookmarks.length)
  const savedInScope = $derived(reference.filter((s) => store.bookmarks.includes(s.id)))
  const savedCount = $derived(savedInScope.length)
  const savedHidden = $derived(savedTotal - savedCount)

  // tier + progress filters stack with category/search/bookmarks; sort reorders
  // the result live. Mastery/struggle come from stats.ts (no duplicate logic).
  const filtered = $derived.by(() => {
    const base =
      cat === 'all'
        ? reference
        : cat === 'bookmarked'
          ? savedInScope
          : reference.filter((s) => s.category === cat)
    let list = searchSigns(base, query)
    if (tier !== 'all') list = list.filter((s) => s.tier === tier)
    if (mastery !== 'all') {
      list = list.filter((s) => {
        const rs = store.reviews[s.id]
        return mastery === 'struggling' ? isStruggling(rs) : cardStage(rs) === mastery
      })
    }
    return sortReference(list, store.reviews, sort)
  })

  const filtersActive = $derived(tier !== 'all' || mastery !== 'all')

  const selected = $derived(
    selectedId ? (reference.find((s) => s.id === selectedId) as SignDefinition) : null,
  )
</script>

<section class="browse">
  <header class="browse__head">
    <h1 class="t-display" id="view-heading" tabindex="-1">Every sign</h1>
    <p class="t-caption">
      {#if cat === 'bookmarked'}
        {savedTotal} saved {savedTotal === 1 ? 'sign' : 'signs'}
      {:else}
        {reference.length} signs — search or filter to find one.
      {/if}
    </p>
  </header>

  <div class="search">
    <span class="search__icon"><Icon name="search" size={18} /></span>
    <input
      class="search__input"
      type="search"
      placeholder="Search signs, e.g. give way, roundabout, 30"
      bind:value={query}
      aria-label="Search signs"
    />
    {#if query}
      <button class="search__clear" onclick={() => (query = '')} aria-label="Clear search">
        <Icon name="x" size={16} />
      </button>
    {/if}
  </div>

  <div class="filters" role="group" aria-label="Filter by category">
    <button
      class="filter filter--saved"
      class:is-active={cat === 'bookmarked'}
      onclick={() => (cat = 'bookmarked')}
      aria-label={`Saved signs, ${store.bookmarks.length}`}
    >
      <Icon name="star" size={13} /> Saved
      <span class="filter__badge t-num">{store.bookmarks.length}</span>
    </button>
    <button class="filter" class:is-active={cat === 'all'} onclick={() => (cat = 'all')}>All</button>
    {#each categories as c (c)}
      <button class="filter" class:is-active={cat === c} onclick={() => (cat = c)}>
        {CATEGORY_META[c].short}
      </button>
    {/each}
  </div>

  <div class="controls">
    <label class="control">
      <span class="control__label t-caption">Tier</span>
      <select class="control__select" bind:value={tier} aria-label="Filter by tier">
        <option value="all">All tiers</option>
        <option value="core">Core</option>
        <option value="standard">Standard</option>
        <option value="edge">Edge</option>
      </select>
    </label>
    <label class="control">
      <span class="control__label t-caption">Progress</span>
      <select class="control__select" bind:value={mastery} aria-label="Filter by progress">
        <option value="all">Any progress</option>
        <option value="new">New</option>
        <option value="learning">Learning</option>
        <option value="settling">Settling</option>
        <option value="mastered">Mastered</option>
        <option value="struggling">Struggling</option>
      </select>
    </label>
    <label class="control">
      <span class="control__label t-caption">Sort</span>
      <select class="control__select" bind:value={sort} aria-label="Sort signs">
        <option value="default">Default order</option>
        <option value="worst">Worst first</option>
        <option value="seen">Most seen</option>
        <option value="due">Due soonest</option>
        <option value="mastered">Mastered first</option>
      </select>
    </label>
  </div>

  {#if filtered.length}
    <ul class="grid">
      {#each filtered as sign (sign.id)}
        <li class="cell">
          <button class="signcard" onclick={() => (selectedId = sign.id)}>
            <span class="signcard__art"><SignPlate {sign} /></span>
            <span class="signcard__cap">{sign.caption}</span>
          </button>
          <span class="signcard__star">
            <BookmarkButton id={sign.id} caption={sign.caption} variant="card" />
          </span>
        </li>
      {/each}
    </ul>
    {#if cat === 'bookmarked' && savedHidden > 0}
      <p class="hint t-caption">
        {savedHidden} saved motorway {savedHidden === 1 ? 'sign is' : 'signs are'} hidden — turn
        on the motorway module in Settings to see {savedHidden === 1 ? 'it' : 'them'}.
      </p>
    {/if}
  {:else if cat === 'bookmarked' && store.bookmarks.length === 0}
    <div class="empty empty--rich">
      <span class="empty__icon"><Icon name="star" size={22} /></span>
      <p class="t-body">No saved signs yet.</p>
      <p class="t-caption">
        Tap the star on any sign to save it here — handy for the ones you keep mixing up.
      </p>
    </div>
  {:else if cat === 'bookmarked' && savedCount === 0}
    <div class="empty empty--rich">
      <span class="empty__icon"><Icon name="star" size={22} /></span>
      <p class="t-body">Your saved signs are hidden right now.</p>
      <p class="t-caption">
        {store.bookmarks.length === 1
          ? 'The 1 sign you saved is a motorway sign'
          : `All ${store.bookmarks.length} signs you saved are motorway signs`} — turn on the
        motorway module in Settings to see {store.bookmarks.length === 1 ? 'it' : 'them'}.
      </p>
    </div>
  {:else}
    <p class="empty t-body">
      {#if query && filtersActive}No signs match “{query}” with these filters.{:else if query}No
        signs match “{query}”.{:else}No signs match these filters.{/if} Try widening it.
    </p>
  {/if}
</section>

{#if selected}
  <SignDetail
    sign={selected}
    onClose={() => (selectedId = null)}
    onOpen={(id) => (selectedId = id)}
  />
{/if}

<style>
  .browse {
    display: flex;
    flex-direction: column;
    gap: var(--s-4);
  }
  .browse__head h1 {
    margin-bottom: 2px;
  }

  .search {
    position: relative;
    display: flex;
    align-items: center;
  }
  .search__icon {
    position: absolute;
    left: var(--s-3);
    color: var(--text-faint);
    pointer-events: none;
    display: grid;
    place-items: center;
  }
  .search__input {
    width: 100%;
    height: 46px;
    padding: 0 var(--s-7) 0 var(--s-7);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    background: var(--surface);
    color: var(--text);
    font-size: var(--fs-body);
  }
  .search__input::placeholder {
    color: var(--text-muted);
  }
  .search__input:focus-visible {
    border-color: var(--accent);
  }
  .search__clear {
    position: absolute;
    right: var(--s-2);
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    color: var(--text-muted);
    border-radius: var(--r-pill);
  }
  .search__clear:hover {
    background: var(--surface-hover);
    color: var(--text);
  }

  .filters {
    display: flex;
    gap: var(--s-2);
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: none;
  }
  .filters::-webkit-scrollbar {
    display: none;
  }
  .filter {
    flex: none;
    padding: 7px var(--s-3);
    font-size: var(--fs-caption);
    font-weight: var(--fw-medium);
    color: var(--text-muted);
    border: 1px solid var(--hairline);
    border-radius: var(--r-pill);
    white-space: nowrap;
    transition: all var(--dur-fast) var(--ease-standard);
  }
  .filter:hover {
    color: var(--text-secondary);
  }
  .filter.is-active {
    color: var(--text-on-accent);
    background: var(--accent);
    border-color: var(--accent);
  }
  .filter--saved {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .filter__badge {
    min-width: 18px;
    padding: 0 5px;
    border-radius: var(--r-pill);
    background: var(--surface-sunken);
    color: var(--text-secondary);
    font-size: 11px;
    line-height: 16px;
    text-align: center;
  }
  .filter--saved.is-active .filter__badge {
    background: color-mix(in srgb, var(--ink-100) 18%, transparent);
    color: var(--text-on-accent);
  }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s-3);
  }
  .control {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .control__label {
    color: var(--text-muted);
  }
  .control__select {
    min-height: 38px;
    padding: 0 var(--s-2);
    font-size: var(--fs-caption);
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
  }
  .control__select:focus-visible {
    border-color: var(--accent);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: var(--s-3);
  }
  @media (min-width: 768px) {
    .grid {
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: var(--s-4);
    }
  }
  .signcard {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    padding: var(--s-3);
    border: 1px solid var(--hairline);
    border-radius: var(--r-md);
    background: var(--surface);
    text-align: left;
    transition:
      border-color var(--dur-fast) var(--ease-standard),
      background var(--dur-fast) var(--ease-standard);
  }
  .signcard:hover {
    border-color: var(--border-strong);
    background: var(--surface-hover);
  }
  .signcard__art {
    width: 64%;
    margin: 0 auto;
  }
  .signcard__cap {
    font-size: var(--fs-caption);
    line-height: 1.3;
    color: var(--text-secondary);
  }

  .cell {
    position: relative;
  }
  .signcard__star {
    position: absolute;
    top: 6px;
    right: 6px;
  }
  /* keep the star quiet until the card is hovered/focused, unless already saved */
  .signcard__star :global(.bm--card:not(.is-on)) {
    opacity: 0;
  }
  .cell:hover .signcard__star :global(.bm--card:not(.is-on)),
  .cell:focus-within .signcard__star :global(.bm--card:not(.is-on)) {
    opacity: 1;
  }
  @media (hover: none) {
    /* no hover on touch — always show the star so it stays reachable */
    .signcard__star :global(.bm--card:not(.is-on)) {
      opacity: 1;
      color: var(--text-faint);
    }
  }

  .empty {
    color: var(--text-muted);
    padding: var(--s-6) 0;
    text-align: center;
  }
  .empty--rich {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--s-2);
    max-width: 34ch;
    margin: 0 auto;
    padding: var(--s-7) var(--s-4);
  }
  .empty--rich .t-body {
    color: var(--text-secondary);
  }
  .empty__icon {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    margin-bottom: var(--s-1);
    border-radius: var(--r-pill);
    color: var(--text-muted);
    background: var(--surface-sunken);
  }
  .hint {
    color: var(--text-faint);
    text-align: center;
    margin-top: var(--s-3);
  }
</style>
