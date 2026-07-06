// Flat ESLint config. Lints the app source (TS + Svelte 5) for correctness and
// quality; formatting is Prettier's job (eslint-config-prettier disables any
// stylistic rules that would collide). `scripts/` stay excluded, as they are
// from tsconfig/svelte-check — they're dev-time tooling.
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import svelte from 'eslint-plugin-svelte'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default tseslint.config(
  {
    // outputs and generated/vendored files — never linted
    ignores: [
      'dist/',
      'dev-dist/',
      'coverage/',
      'public/',
      'scripts/',
      'src/data/signs.ts',
      '*.config.{js,ts}',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      // the composite sign art is first-party, build-time SVG rendered via
      // {@html} by design (see compositeArt.ts / SignComposite.svelte) — not
      // user input, so the XSS guard doesn't apply here.
      'svelte/no-at-html-tags': 'off',
      // the flagged Map/Set/Date uses here are non-reactive — a module-level id
      // cache (SIGN_BY_ID), a backup-filename timestamp, and one-shot local
      // computations — so the reactive-wrapper classes aren't warranted.
      'svelte/prefer-svelte-reactivity': 'off',
      // keyed {#each} is used where item identity matters; the remaining blocks
      // render static, positionally-stable lists where a key adds only noise.
      'svelte/require-each-key': 'off',
      // allow deliberately-unused args when prefixed with _ (event handlers etc.)
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // the Svelte <script lang="ts"> blocks and the .svelte.ts rune modules need
    // the TS parser wired into svelte-eslint-parser
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    // vitest unit tests run in Node
    files: ['tests/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  prettier,
)
