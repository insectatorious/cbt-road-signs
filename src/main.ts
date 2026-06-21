import './styles/base.css'
import { mount } from 'svelte'
import App from './App.svelte'
import { initTheme } from './lib/theme.svelte'
import { initRouter } from './lib/router.svelte'

initTheme()
initRouter()

const app = mount(App, { target: document.getElementById('app')! })

export default app
