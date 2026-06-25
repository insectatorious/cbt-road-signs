import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  // The Svelte plugin lets the composite render-guard import `.svelte`
  // components and render them headlessly via `svelte/server`.
  plugins: [svelte()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
