/** Dependency-free client-side search over the sign deck. */
import { CATEGORY_META, type SignDefinition } from './types'

const COMBINING = new RegExp('[\\u0300-\\u036f]', 'g')

export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(COMBINING, '')
}

/** Is `needle` a subsequence of `hay`? (cheap fuzzy fallback) */
function isSubsequence(needle: string, hay: string): boolean {
  let i = 0
  for (let j = 0; j < hay.length && i < needle.length; j++) {
    if (hay[j] === needle[i]) i++
  }
  return i === needle.length
}

function haystack(s: SignDefinition): string {
  return normalize(
    [
      s.caption,
      CATEGORY_META[s.category].label,
      CATEGORY_META[s.category].short,
      s.subcategory ?? '',
      s.diagram ?? '',
      s.searchTerms.join(' '),
    ].join(' '),
  )
}

/** Returns matching signs ranked by relevance. Empty query → input order. */
export function searchSigns(deck: SignDefinition[], query: string): SignDefinition[] {
  const q = normalize(query.trim())
  if (!q) return deck
  const tokens = q.split(/\s+/).filter(Boolean)

  const scored: { s: SignDefinition; score: number }[] = []
  for (const s of deck) {
    const hay = haystack(s)
    const cap = normalize(s.caption)
    let score = 0
    let matchedAll = true
    for (const t of tokens) {
      if (cap.startsWith(t)) score += 24
      else if (cap.includes(t)) score += 16
      else if (hay.includes(t)) score += 8
      else if (t.length >= 3 && isSubsequence(t, cap)) score += 3
      else {
        matchedAll = false
        break
      }
    }
    if (matchedAll && score > 0) scored.push({ s, score })
  }
  scored.sort((a, b) => b.score - a.score || a.s.caption.localeCompare(b.s.caption))
  return scored.map((x) => x.s)
}
