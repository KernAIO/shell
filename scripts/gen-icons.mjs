/**
 * Generates every icon the app shell serves, from one definition of the Kern mark.
 *
 * Run `pnpm icons` after changing the mark. Output goes to `static/` and is committed, so a
 * build — and a contributor who has never run this — never needs sharp.
 *
 * The "K" is a path, not a `<text>` element, on purpose. A `<text>` mark renders in whatever
 * font the rasteriser happens to have: sharp on CI has no Instrument Sans and silently falls
 * back to Helvetica, and a browser showing `favicon.svg` does the same. The outline below was
 * taken from Instrument Sans at `wght` 600 (1000 units/em, cap height 720, y-up) so every
 * surface draws the same letter.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const staticDir = join(root, 'static')
const iconsDir = join(staticDir, 'icons')

/** DESIGN.md §1.1 — ink-900 square, surface as the inverse ink, accent for the tick. */
const INK = '#1C1A17'
const PAPER = '#FBFAF7'
const ACCENT = '#B4661C'

/** Instrument Sans "K", `wght` 600. Font units: 1000/em, cap height 720, baseline at y=0, y-up. */
const K_PATH =
  'M61.999267578125 0V720H192.000732421875V0ZM156.333251953125 374 496.9989013671875 720H672.000732421875L316.668212890625 374ZM512.9989013671875 0 154.333251953125 374H316.668212890625L692.000732421875 0Z'
const K_LEFT = 61.999267578125
const K_RIGHT = 692.000732421875
const K_CAP = 720

/*
 * The mark is drawn on a 144×144 grid — the same proportions as `RailLogo` (a 36px square with a
 * 2×14 tick), scaled ×4 so every value stays a round number.
 *
 * `<text>` centred the *advance box*, which includes the K's side bearings and left the lockup
 * visibly off-centre in the square. Measuring the actual ink and centring the K + tick group as a
 * unit is what the eye expects, and it matters at 512px on a home screen.
 */
const GRID = 144
const EM = 76 / 1000 // font units → grid units, matching the 76px "font-size" the mark had
const K_W = (K_RIGHT - K_LEFT) * EM
const K_H = K_CAP * EM
const GAP = 9.5
const TICK_W = 9
const TICK_H = 56
const TICK_R = 4.5

const lockupW = K_W + GAP + TICK_W
const left = (GRID - lockupW) / 2
const top = (GRID - TICK_H) / 2
const round = (value) => Number(value.toFixed(3))

const lockup = [
  // scale y negatively: font outlines are y-up, SVG is y-down. The baseline lands on `ky`.
  `<g transform="translate(${round(left - K_LEFT * EM)} ${round(top + (TICK_H + K_H) / 2)}) scale(${EM} -${EM})" fill="${PAPER}">`,
  `<path d="${K_PATH}"/>`,
  '</g>',
  `<rect x="${round(left + K_W + GAP)}" y="${top}" width="${TICK_W}" height="${TICK_H}" rx="${TICK_R}" fill="${ACCENT}"/>`,
].join('')

/**
 * `bleed` fills the square to its edges instead of rounding it.
 *
 * Rounded corners are right for a favicon and for Android's `purpose: any`, and wrong everywhere a
 * platform applies its own mask: iOS rounds the apple-touch-icon itself, and a maskable icon can be
 * cropped to a circle. Transparent corners under either produce a pale halo.
 *
 * The lockup sits inside the maskable safe zone (a circle of 80% the width) without shrinking: its
 * half-diagonal is ~43 of the 57.6 available.
 */
const mark = ({ bleed = false } = {}) =>
  [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${GRID}" height="${GRID}" viewBox="0 0 ${GRID} ${GRID}" role="img" aria-label="Kern">`,
    // a standalone SVG needs a name for anyone who opens or reads it on its own
    '<title>Kern</title>',
    `<rect width="${GRID}" height="${GRID}"${bleed ? '' : ' rx="36"'} fill="${INK}"/>`,
    lockup,
    '</svg>',
  ].join('')

/** `density` oversamples the rasteriser so the diagonals are clean at small sizes. */
const png = (svg, size) =>
  sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer()

await mkdir(iconsDir, { recursive: true })

// The crisp one. Modern browsers prefer it and it stays sharp on any display.
await writeFile(join(staticDir, 'favicon.svg'), `${mark()}\n`)

const rounded = mark()
const bleed = mark({ bleed: true })

for (const [name, size, svg] of [
  ['icon-192.png', 192, rounded],
  ['icon-512.png', 512, rounded],
  ['apple-touch-icon.png', 180, bleed],
  ['maskable-192.png', 192, bleed],
  ['maskable-512.png', 512, bleed],
]) {
  await writeFile(join(iconsDir, name), await png(svg, size))
}

// favicon.ico — a 32px PNG in an ICO container is enough for every browser still asking for one.
const ico32 = await png(rounded, 32)
const header = Buffer.alloc(22)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type: icon
header.writeUInt16LE(1, 4) // one image
header.writeUInt8(32, 6) // width
header.writeUInt8(32, 7) // height
header.writeUInt8(0, 8) // palette entries
header.writeUInt8(0, 9) // reserved
header.writeUInt16LE(1, 10) // colour planes
header.writeUInt16LE(32, 12) // bits per pixel
header.writeUInt32LE(ico32.length, 14)
header.writeUInt32LE(22, 18) // offset of the image data
await writeFile(join(staticDir, 'favicon.ico'), Buffer.concat([header, ico32]))

console.log('Wrote static/favicon.svg, static/favicon.ico and 5 icons in static/icons/')
