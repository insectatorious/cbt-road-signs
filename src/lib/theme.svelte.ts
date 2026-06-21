/**
 * Tri-state theme controller (System / Light / Dark).
 * The preference is stored separately from the resolved value so
 * "System" can keep tracking the OS while Light/Dark are explicit.
 * The inline bootstrap in index.html sets the initial [data-theme]
 * before first paint; this keeps it in sync thereafter.
 */
export type ThemePref = 'system' | 'light' | 'dark'

const KEY = 'cbt-theme'
const mql = window.matchMedia('(prefers-color-scheme: dark)')

function stored(): ThemePref {
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

function resolve(pref: ThemePref): 'light' | 'dark' {
  if (pref === 'system') return mql.matches ? 'dark' : 'light'
  return pref
}

export const theme = $state({
  pref: stored(),
  resolved: (document.documentElement.dataset.theme as 'light' | 'dark') || 'light',
})

function apply(pref: ThemePref): void {
  const r = resolve(pref)
  theme.resolved = r
  document.documentElement.dataset.theme = r
}

export function initTheme(): void {
  apply(theme.pref)
  mql.addEventListener('change', () => {
    if (theme.pref === 'system') apply('system')
  })
}

export function setTheme(pref: ThemePref): void {
  theme.pref = pref
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    /* private mode — keep in-memory */
  }
  apply(pref)
}
