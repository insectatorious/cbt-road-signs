/* Sumanas typefaces — self-hosted (offline-first PWA, no runtime font fetch).
   Latin subsets only, weights the UI actually uses, to keep the precache lean. */
import '@fontsource-variable/lexend/wght.css' // default UI + body sans
import '@fontsource-variable/newsreader/wght.css' // editorial display serif
import '@fontsource/atkinson-hyperlegible/latin-400.css' // long-form reading
import '@fontsource/atkinson-hyperlegible/latin-700.css'
import '@fontsource/atkinson-hyperlegible/latin-400-italic.css'
import '@fontsource/ibm-plex-mono/latin-400.css' // tabular figures
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-600.css'
import './styles/base.css'
import { mount } from 'svelte'
import App from './App.svelte'
import { initTheme } from './lib/theme.svelte'
import { initRouter } from './lib/router.svelte'
import { requestPersistence } from './lib/storage'
import { initAnalytics } from './lib/analytics'
import { store } from './lib/store.svelte'
import { syncReminder } from './lib/reminders'

initTheme()
initRouter()
// Ask the browser to keep our progress durable (best-effort; resolves false if denied).
void requestPersistence()
// Privacy-friendly, cookieless analytics — no-op unless VITE_GOATCOUNTER is set.
initAnalytics()
// Re-arm the opt-in daily reminder for its next occurrence (no-op when off/unsupported).
void syncReminder(store.settings.remindersEnabled, store.settings.reminderTime)

const app = mount(App, { target: document.getElementById('app')! })

export default app
