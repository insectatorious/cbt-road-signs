import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves from a repo subpath; Netlify (and dev) from root.
// Switch with: DEPLOY_TARGET=gh-pages npm run build
const base = process.env.DEPLOY_TARGET === 'gh-pages' ? '/cbt-flashcards/' : '/'

export default defineConfig({
  base,
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Road Signs — CBT Revision',
        short_name: 'CBT Signs',
        description:
          'Spaced-repetition revision for the UK motorcycle CBT road signs.',
        theme_color: '#1a1a18',
        background_color: '#1a1a18',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    target: 'es2020',
    sourcemap: false,
  },
})
