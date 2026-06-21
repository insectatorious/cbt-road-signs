/**
 * Tiny hash router. Hash routing means a static host needs no
 * rewrite rules — index.html always serves. State is a rune so
 * components re-render on route change.
 */
export type Route = 'study' | 'quiz' | 'browse' | 'report' | 'settings'

export const ROUTES: Route[] = ['study', 'quiz', 'browse', 'report', 'settings']

function parse(): Route {
  const h = location.hash.replace(/^#\/?/, '').split('?')[0] as Route
  return ROUTES.includes(h) ? h : 'study'
}

export const router = $state({ route: parse() })

export function initRouter(): void {
  window.addEventListener('hashchange', () => {
    router.route = parse()
    // Move focus to the main heading for screen-reader users.
    requestAnimationFrame(() => {
      document.getElementById('view-heading')?.focus()
    })
  })
  if (!location.hash) location.replace('#/study')
}

export function navigate(route: Route): void {
  if (route !== router.route) location.hash = '#/' + route
}
