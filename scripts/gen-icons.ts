/** Generates PWA/app icons from an inline SVG. Run: npm run gen-icons */
import { mkdirSync } from 'node:fs'
import sharp from 'sharp'

const OUT = new URL('../public/icons/', import.meta.url)
mkdirSync(OUT, { recursive: true })

// `maskable` fills the whole square (no rounded corners) so any platform mask
// shows the dark tile; the roundel sits well inside the safe zone.
const svg = (maskable: boolean) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${maskable ? 0 : 104}" fill="#1a1a18"/>
  <circle cx="256" cy="256" r="150" fill="none" stroke="#f4f2ec" stroke-width="40"/>
  <circle cx="256" cy="256" r="54" fill="#d99b2b"/>
</svg>`

async function png(maskable: boolean, size: number, name: string) {
  await sharp(Buffer.from(svg(maskable))).resize(size, size).png().toFile(
    new URL(name, OUT).pathname,
  )
  console.log(`✓ ${name}`)
}

await png(false, 192, 'icon-192.png')
await png(false, 512, 'icon-512.png')
await png(true, 512, 'icon-maskable-512.png')
await png(false, 180, 'apple-touch-icon.png')
