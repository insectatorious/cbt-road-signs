/** Generates CHANGELOG.md from src/data/changelog.ts (the single source of truth
 *  the app also reads for its version + "last updated" date).
 *  Run: npm run build-changelog */
import { writeFileSync } from 'node:fs'
import { CHANGELOG } from '../src/data/changelog'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
function fmt(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[(m || 1) - 1]} ${y}`
}

const body = CHANGELOG.map(
  (r) => `## ${r.version} — ${fmt(r.date)}\n\n${r.changes.map((c) => `- ${c}`).join('\n')}`,
).join('\n\n')

const md = `# Changelog

All notable changes to this project. **Generated** from \`src/data/changelog.ts\`
(the in-app release notes) — edit that and run \`npm run build-changelog\`.

${body}
`

writeFileSync(new URL('../CHANGELOG.md', import.meta.url), md)
console.log(`Wrote CHANGELOG.md (${CHANGELOG.length} releases)`)
