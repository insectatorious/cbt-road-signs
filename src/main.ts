import './styles/base.css'
import { mount } from 'svelte'
import App from './App.svelte'
import { initTheme } from './lib/theme.svelte'
import { initRouter } from './lib/router.svelte'
import { requestPersistence } from './lib/storage'

initTheme()
initRouter()
// Ask the browser to keep our progress durable (best-effort; resolves false if denied).
void requestPersistence()

const app = mount(App, { target: document.getElementById('app')! })

export default app
