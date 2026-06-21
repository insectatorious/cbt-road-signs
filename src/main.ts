import './styles/base.css'
import { mount } from 'svelte'
import App from './App.svelte'
import { initTheme } from './lib/theme.svelte'
import { initRouter } from './lib/router.svelte'
import { requestPersistence } from './lib/storage'
import { initAnalytics } from './lib/analytics'

initTheme()
initRouter()
// Ask the browser to keep our progress durable (best-effort; resolves false if denied).
void requestPersistence()
// Privacy-friendly, cookieless analytics — no-op unless VITE_GOATCOUNTER is set.
initAnalytics()

const app = mount(App, { target: document.getElementById('app')! })

export default app
