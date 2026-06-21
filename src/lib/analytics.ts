/** Privacy-friendly, cookieless analytics via GoatCounter.
 *
 *  No-op unless an endpoint is provided at build time (`VITE_GOATCOUNTER`), so
 *  local dev and forks send nothing and the "no tracking by default" promise
 *  holds. GoatCounter sets no cookies and stores no personal data; we count one
 *  anonymous hit per hash-router view. */
const ENDPOINT = import.meta.env.VITE_GOATCOUNTER as string | undefined

interface GoatCounter {
  count?: (opts: { path: string }) => void
}

function routePath(): string {
  const h = location.hash.replace(/^#\/?/, '').split('?')[0]
  return '/' + (h || 'study')
}

function count(): void {
  ;(window as unknown as { goatcounter?: GoatCounter }).goatcounter?.count?.({ path: routePath() })
}

export function initAnalytics(): void {
  if (!ENDPOINT || typeof document === 'undefined') return
  const s = document.createElement('script')
  s.async = true
  s.src = 'https://gc.zgo.at/count.js'
  s.dataset.goatcounter = ENDPOINT
  s.dataset.goatcounterSettings = JSON.stringify({ no_onload: true }) // we count manually
  s.addEventListener('load', count) // first view, once the script is ready
  document.head.appendChild(s)
  window.addEventListener('hashchange', count) // subsequent SPA views
}
