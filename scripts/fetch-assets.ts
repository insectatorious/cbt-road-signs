/**
 * Downloads the official OGL sign SVGs from Wikimedia Commons into
 * src/assets/signs/, keyed by the verified filenames in src/data/_gen.
 * Writes ATTRIBUTION.md. Fails loudly (lists 404s) so curation gaps surface.
 * Run: npm run fetch-assets
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'

const GEN = new URL('../src/data/_gen/', import.meta.url)
const OUT = new URL('../src/assets/signs/', import.meta.url)
mkdirSync(OUT, { recursive: true })

interface Meta {
  id: string
  sourceUrl?: string
}
const assets = new Map<string, Meta>()
for (const f of readdirSync(GEN)) {
  if (!f.endsWith('.json')) continue
  for (const s of JSON.parse(readFileSync(new URL(f, GEN), 'utf8'))) {
    if (!s.composite && s.asset) assets.set(s.asset, { id: s.id, sourceUrl: s.sourceUrl })
  }
}

const UA = 'cbt-flashcards/1.0 (educational revision app; +https://github.com/)'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Fetch with 404→encoded-name fallback and backoff on 429/5xx. */
async function tryFetch(file: string): Promise<Buffer | number> {
  const md5 = createHash('md5').update(file).digest('hex')
  const base = `https://upload.wikimedia.org/wikipedia/commons/${md5[0]}/${md5.slice(0, 2)}/`
  const names = file === encodeURIComponent(file) ? [file] : [file, encodeURIComponent(file)]
  let last = 0
  for (let attempt = 0; attempt < 6; attempt++) {
    for (const name of names) {
      const res = await fetch(base + name, { headers: { 'User-Agent': UA } })
      if (res.ok) return Buffer.from(await res.arrayBuffer())
      last = res.status
      if (res.status === 404) continue // try the encoded variant
      break
    }
    if (last === 404) return 404
    await sleep(700 * (attempt + 1)) // back off on 429 / 5xx
  }
  return last
}

const ok: string[] = []
const failed: { file: string; status: number; id: string }[] = []
const attribution: { file: string; url: string }[] = []

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>): Promise<void> {
  const queue = items.slice()
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (queue.length) {
        const it = queue.shift()
        if (it !== undefined) await fn(it)
      }
    }),
  )
}

const entries = [...assets.entries()]
await pool(entries, 1, async ([file, meta]) => {
  const dest = new URL(file, OUT)
  const url = meta.sourceUrl || `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`
  if (existsSync(dest)) {
    ok.push(file)
    attribution.push({ file, url })
    return
  }
  const result = await tryFetch(file)
  if (Buffer.isBuffer(result)) {
    writeFileSync(dest, result)
    ok.push(file)
    attribution.push({ file, url })
    process.stdout.write('.')
  } else {
    failed.push({ file, status: result, id: meta.id })
    process.stdout.write('x')
  }
  await sleep(400)
})

attribution.sort((a, b) => a.file.localeCompare(b.file))
const attrib = `# Sign artwork — attribution & licence

The SVG road-sign artwork in this directory consists of official UK traffic
signs obtained from **Wikimedia Commons** and is Crown copyright, reproduced
under the **Open Government Licence**.

> Contains public sector information licensed under the Open Government Licence v3.0.
> https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/

The signs are reproduced accurately for educational revision and are not altered
in a way that would mislead. Source files (${attribution.length}):

${attribution.map((a) => `- \`${a.file}\` — ${a.url}`).join('\n')}
`
writeFileSync(new URL('ATTRIBUTION.md', OUT), attrib)

console.log(`\n\nDownloaded/cached: ${ok.length}/${entries.length}`)
if (failed.length) {
  console.log(`\n⚠ ${failed.length} could NOT be fetched (will render as placeholders):`)
  for (const f of failed) console.log(`  - ${f.id}: ${f.file} (HTTP ${f.status})`)
}
