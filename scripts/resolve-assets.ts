/**
 * Resolves the SVGs that fetch-assets could not download (the Commons filename
 * guessed by the authoring agents was wrong). Uses the MediaWiki API to find
 * the real file by search, downloads it, and saves it under the LOCAL filename
 * the dataset references (so signs.ts needs no change). Logs each choice so the
 * mapping can be eyeballed. Run: npm run resolve-assets
 */
import { existsSync, writeFileSync } from 'node:fs'

const OUT = new URL('../src/assets/signs/', import.meta.url)
const API = 'https://commons.wikimedia.org/w/api.php'
const UA = 'cbt-flashcards/1.0 (educational revision app)'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Target {
  asset: string // local filename to save as (referenced by signs.ts)
  q: string // search query
  keywords: string[] // preferred match in title (lowercased)
  num: string // diagram number to require/prefer in the title
}

const TARGETS: Target[] = [
  { asset: 'UK_traffic_sign_504.1.svg', q: 'UK traffic sign 504 crossroads', keywords: ['crossroad'], num: '504' },
  { asset: 'UK_traffic_sign_505.1.svg', q: 'UK traffic sign 505 T junction', keywords: ['junction'], num: '505' },
  { asset: 'UK_traffic_sign_507.1.svg', q: 'UK traffic sign 507 staggered junction', keywords: ['stagger', 'junction'], num: '507' },
  { asset: 'UK_traffic_sign_506.1.svg', q: 'UK traffic sign 506 side road ahead', keywords: ['side road', 'junction'], num: '506' },
  { asset: 'UK_traffic_sign_512.svg', q: 'UK traffic sign 512 bend', keywords: ['bend'], num: '512' },
  { asset: 'UK_traffic_sign_513.svg', q: 'UK traffic sign 513 double bend', keywords: ['bend'], num: '513' },
  { asset: 'UK_traffic_sign_606.svg', q: 'UK traffic sign 606 turn left', keywords: ['left', 'turn'], num: '606' },
  { asset: 'UK_traffic_sign_626.1.svg', q: 'UK traffic sign 626 gross weight', keywords: ['weight', 'gross'], num: '626' },
  { asset: 'UK_traffic_sign_629.1.svg', q: 'UK traffic sign 629 length', keywords: ['length'], num: '629' },
  { asset: 'UK_traffic_sign_559.svg', q: 'UK traffic sign 559 falling rocks', keywords: ['rock', 'falling'], num: '559' },
  { asset: 'UK_traffic_sign_609.svg', q: 'UK traffic sign 609 turn left ahead', keywords: ['left', 'ahead'], num: '609' },
  { asset: 'UK_traffic_sign_610.svg', q: 'UK traffic sign 610 keep left', keywords: ['left', 'keep'], num: '610' },
]

interface Cand {
  title: string
  url: string
}

async function search(q: string): Promise<Cand[]> {
  const u = `${API}?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=20&gsrsearch=${encodeURIComponent(
    q,
  )}&prop=imageinfo&iiprop=url|mime`
  const res = await fetch(u, { headers: { 'User-Agent': UA } })
  if (!res.ok) return []
  const data = (await res.json()) as {
    query?: { pages?: Record<string, { title: string; imageinfo?: { url: string; mime: string }[] }> }
  }
  const out: Cand[] = []
  for (const p of Object.values(data.query?.pages ?? {})) {
    const info = p.imageinfo?.[0]
    if (info?.mime === 'image/svg+xml') out.push({ title: p.title, url: info.url })
  }
  return out
}

function score(c: Cand, t: Target): number {
  const title = c.title.toLowerCase()
  let s = 0
  if (title.includes(`sign ${t.num}`) || title.includes(`sign_${t.num}`)) s += 6
  for (const k of t.keywords) if (title.includes(k)) s += 2
  if (/(plate|zone|map|on a |\bgantry\b)/.test(title)) s -= 4
  return s
}

async function download(url: string): Promise<Buffer | number> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (res.ok) return Buffer.from(await res.arrayBuffer())
    if (res.status !== 429 && res.status < 500) return res.status
    await sleep(2000 * (attempt + 1))
  }
  return 429
}

let done = 0
for (const t of TARGETS) {
  const dest = new URL(t.asset, OUT)
  if (existsSync(dest)) {
    done++
    continue
  }
  const all = await search(t.q)
  // only official UK traffic-sign files
  const cands = all.filter((c) => /uk traffic sign/i.test(c.title))
  if (!cands.length) {
    console.log(`✗ ${t.asset}: no UK candidates for "${t.q}"`)
    continue
  }
  cands.sort((a, b) => score(b, t) - score(a, t))
  const best = cands[0]
  const buf = await download(best.url)
  if (Buffer.isBuffer(buf)) {
    writeFileSync(dest, buf)
    done++
    console.log(`✓ ${t.asset}  ←  ${best.title}`)
  } else {
    console.log(`✗ ${t.asset}: download ${buf} for ${best.title}`)
  }
  await sleep(800)
}
console.log(`\nResolved ${done}/${TARGETS.length}`)
