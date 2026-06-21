<script lang="ts">
  import SignPlate from '../components/SignPlate.svelte'
  import SignDetail from '../components/SignDetail.svelte'
  import Icon from '../components/Icon.svelte'
  import { SIGNS } from '../lib/store.svelte'
  import { searchSigns } from '../lib/search'
  import { CATEGORY_META, type SignCategory, type SignDefinition } from '../lib/types'

  // The reference is the COMPLETE set (minus motorway), regardless of study settings.
  const reference = SIGNS.filter((s) => !s.excludeFromV1)

  const categories = (Object.keys(CATEGORY_META) as SignCategory[]).sort(
    (a, b) => CATEGORY_META[a].order - CATEGORY_META[b].order,
  )

  let query = $state('')
  let cat = $state<SignCategory | 'all'>('all')
  let selectedId = $state<string | null>(null)

  const filtered = $derived.by(() => {
    const base = cat === 'all' ? reference : reference.filter((s) => s.category === cat)
    return searchSigns(base, query)
  })

  const selected = $derived(
    selectedId ? (reference.find((s) => s.id === selectedId) as SignDefinition) : null,
  )
</script>

<section class="browse">
  <header class="browse__head">
    <h1 class="t-display" id="view-heading" tabindex="-1">Every sign</h1>
    <p class="t-caption">{reference.length} signs — search or filter to find one.</p>
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
    <button class="filter" class:is-active={cat === 'all'} onclick={() => (cat = 'all')}>All</button>
    {#each categories as c (c)}
      <button class="filter" class:is-active={cat === c} onclick={() => (cat = c)}>
        {CATEGORY_META[c].short}
      </button>
    {/each}
  </div>

  {#if filtered.length}
    <ul class="grid">
      {#each filtered as sign (sign.id)}
        <li>
          <button class="signcard" onclick={() => (selectedId = sign.id)}>
            <span class="signcard__art"><SignPlate {sign} /></span>
            <span class="signcard__cap">{sign.caption}</span>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty t-body">No signs match “{query}”. Try another word.</p>
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
    color: var(--text-faint);
  }
  .search__input:focus-visible {
    border-color: var(--amber);
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
    background: var(--amber-strong);
    border-color: var(--amber-strong);
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
  .empty {
    color: var(--text-muted);
    padding: var(--s-6) 0;
    text-align: center;
  }
</style>
