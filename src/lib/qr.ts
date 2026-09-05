/**
 * A QR encoder, because a two-factor secret has to be scannable.
 *
 * Enrolment is the one screen in Kern where a person has to move a string from this app into
 * another one on a different device, and typing a 32-character base32 secret by hand is where
 * people give up. The manual key is still shown beside it — an authenticator on the same machine
 * has nothing to point a camera at — but the picture is what makes the flow ordinary.
 *
 * Deliberately small: **byte mode, error-correction level M, versions 1 to 14**. That is 362 bytes,
 * where an `otpauth://` URI is around 110, and it keeps the tables short enough to read. Anything
 * longer throws rather than silently drawing a code no scanner can read — the caller shows the
 * manual key alone. Nothing here is QR-specific to Kern, so it takes a string and returns a
 * matrix; `QrCode.svelte` is what turns that into an SVG.
 *
 * Verified against a reference encoder rather than by eye — see `qr.test.ts`. A QR that is wrong by
 * one module still looks exactly like a QR.
 */

/** Highest version this encoder builds. Version 14 at level M carries 362 bytes. */
export const QR_MAX_VERSION = 14

/**
 * Error-correction blocks per version at level M, as
 * `[ecCodewordsPerBlock, blocksInGroup1, dataCodewordsInGroup1, blocksInGroup2, dataCodewordsInGroup2]`.
 * Straight out of ISO/IEC 18004 table 9; index 0 is version 1.
 */
const EC_BLOCKS_M: readonly (readonly [number, number, number, number, number])[] = [
  [10, 1, 16, 0, 0],
  [16, 1, 28, 0, 0],
  [26, 1, 44, 0, 0],
  [18, 2, 32, 0, 0],
  [24, 2, 43, 0, 0],
  [16, 4, 27, 0, 0],
  [18, 4, 31, 0, 0],
  [22, 2, 38, 2, 39],
  [22, 3, 36, 2, 37],
  [26, 4, 43, 1, 44],
  [30, 1, 50, 4, 51],
  [22, 6, 36, 2, 37],
  [22, 8, 37, 1, 38],
  [24, 4, 40, 5, 41],
]

/** Row/column centres of the alignment patterns, per version. Version 1 has none. */
const ALIGNMENT: readonly (readonly number[])[] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
]

// ---------------------------------------------------------------------------
// GF(256), the field Reed–Solomon works in. Primitive polynomial 0x11d, generator 2.
// ---------------------------------------------------------------------------
const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
{
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!
}
const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a]! + LOG[b]!]!)

/** g(x) = ∏(x − α^i), highest-degree coefficient first. */
function generatorPoly(degree: number): number[] {
  let poly = [1]
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0)
    for (let j = 0; j < poly.length; j++) {
      next[j] = next[j]! ^ poly[j]!
      next[j + 1] = next[j + 1]! ^ mul(poly[j]!, EXP[i]!)
    }
    poly = next
  }
  return poly
}

/** The remainder of dividing the data codewords by the generator: the error-correction block. */
function ecCodewords(data: readonly number[], count: number): number[] {
  const gen = generatorPoly(count)
  const buf = new Array<number>(data.length + count).fill(0)
  for (let i = 0; i < data.length; i++) buf[i] = data[i]!
  for (let i = 0; i < data.length; i++) {
    const factor = buf[i]!
    if (factor === 0) continue
    for (let j = 0; j < gen.length; j++) buf[i + j] = buf[i + j]! ^ mul(gen[j]!, factor)
  }
  return buf.slice(data.length)
}

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

/** Data codewords a version holds at level M — what has to fit after the header and padding. */
function dataCapacity(version: number): number {
  const [, b1, d1, b2, d2] = EC_BLOCKS_M[version - 1]!
  return b1 * d1 + b2 * d2
}

/** The smallest version that holds `byteLength` bytes in byte mode, or 0 when none does. */
function versionFor(byteLength: number): number {
  for (let version = 1; version <= QR_MAX_VERSION; version++) {
    // 4 bits of mode, then the character count: 8 bits below version 10, 16 bits from 10 up
    const headerBits = 4 + (version < 10 ? 8 : 16)
    if (headerBits + byteLength * 8 <= dataCapacity(version) * 8) return version
  }
  return 0
}

/** Mode indicator, length, payload, terminator and the alternating pad bytes. */
function dataCodewords(bytes: Uint8Array, version: number): number[] {
  const capacity = dataCapacity(version)
  const bits: number[] = []
  const push = (value: number, width: number) => {
    for (let i = width - 1; i >= 0; i--) bits.push((value >> i) & 1)
  }
  push(0b0100, 4)
  push(bytes.length, version < 10 ? 8 : 16)
  for (const byte of bytes) push(byte, 8)
  // terminator: up to four zero bits, then round up to a whole byte
  for (let i = 0; i < 4 && bits.length < capacity * 8; i++) bits.push(0)
  while (bits.length % 8 !== 0) bits.push(0)

  const words: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let word = 0
    for (let j = 0; j < 8; j++) word = (word << 1) | bits[i + j]!
    words.push(word)
  }
  for (let i = 0; words.length < capacity; i++) words.push(i % 2 === 0 ? 0xec : 0x11)
  return words
}

/** Split into blocks, error-correct each, then interleave both halves as the standard requires. */
function interleave(words: readonly number[], version: number): number[] {
  const [ecPerBlock, b1, d1, b2, d2] = EC_BLOCKS_M[version - 1]!
  const dataBlocks: number[][] = []
  const ecBlocks: number[][] = []
  let at = 0
  for (let i = 0; i < b1 + b2; i++) {
    const size = i < b1 ? d1 : d2
    const block = words.slice(at, at + size)
    at += size
    dataBlocks.push(block)
    ecBlocks.push(ecCodewords(block, ecPerBlock))
  }
  const out: number[] = []
  const longest = Math.max(d1, d2)
  for (let i = 0; i < longest; i++) for (const block of dataBlocks) if (i < block.length) out.push(block[i]!)
  for (let i = 0; i < ecPerBlock; i++) for (const block of ecBlocks) out.push(block[i]!)
  return out
}

// ---------------------------------------------------------------------------
// The matrix
// ---------------------------------------------------------------------------

type Grid = { size: number; dark: boolean[][]; fixed: boolean[][] }

function blankGrid(version: number): Grid {
  const size = version * 4 + 17
  return {
    size,
    dark: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
    fixed: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
  }
}

function set(grid: Grid, row: number, col: number, dark: boolean) {
  grid.dark[row]![col] = dark
  grid.fixed[row]![col] = true
}

function drawFunctionPatterns(grid: Grid, version: number) {
  const { size } = grid
  // finders and their separators
  for (const [top, left] of [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ] as const) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = top + r
        const col = left + c
        if (row < 0 || row >= size || col < 0 || col >= size) continue
        const inRing = r >= 0 && r <= 6 && c >= 0 && c <= 6
        const onEdge = r === 0 || r === 6 || c === 0 || c === 6
        const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4
        set(grid, row, col, inRing && (onEdge || inCore))
      }
    }
  }
  // timing
  for (let i = 8; i < size - 8; i++) {
    set(grid, 6, i, i % 2 === 0)
    set(grid, i, 6, i % 2 === 0)
  }
  // alignment, wherever it does not land on a finder
  const centres = ALIGNMENT[version - 1]!
  for (const r of centres) {
    for (const c of centres) {
      if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue
      for (let dr = -2; dr <= 2; dr++)
        for (let dc = -2; dc <= 2; dc++) set(grid, r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1)
    }
  }
  // the one module that is always dark
  set(grid, size - 8, 8, true)
  // format information is written after masking; reserve its cells so data skips them
  for (let i = 0; i <= 8; i++) {
    if (!grid.fixed[8]![i]) set(grid, 8, i, false)
    if (!grid.fixed[i]![8]) set(grid, i, 8, false)
  }
  for (let i = 0; i < 8; i++) {
    if (!grid.fixed[8]![size - 1 - i]) set(grid, 8, size - 1 - i, false)
    if (!grid.fixed[size - 1 - i]![8]) set(grid, size - 1 - i, 8, false)
  }
  if (version >= 7) {
    const bits = versionBits(version)
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >> i) & 1) === 1
      const a = Math.floor(i / 3)
      const b = (i % 3) + size - 11
      set(grid, a, b, dark)
      set(grid, b, a, dark)
    }
  }
}

/** BCH(18,6) version information, for version 7 and up. */
function versionBits(version: number): number {
  let rest = version << 12
  for (let i = 0; i < 12; i++) if ((rest >> (17 - i)) & 1) rest ^= 0x1f25 << (5 - i)
  return (version << 12) | rest
}

/** BCH(15,5) format information for level M and the chosen mask, masked with 0x5412. */
function formatBits(mask: number): number {
  const data = (0b00 << 3) | mask
  let rest = data << 10
  for (let i = 0; i < 5; i++) if ((rest >> (14 - i)) & 1) rest ^= 0x537 << (4 - i)
  return ((data << 10) | rest) ^ 0x5412
}

function writeFormat(grid: Grid, mask: number) {
  const { size } = grid
  const bits = formatBits(mask)
  for (let i = 0; i < 15; i++) {
    const dark = ((bits >> i) & 1) === 1
    // the copy beside the top-left finder, stepping around the timing row and column
    if (i < 6) grid.dark[i]![8] = dark
    else if (i === 6) grid.dark[7]![8] = dark
    else if (i === 7) grid.dark[8]![8] = dark
    else if (i === 8) grid.dark[8]![7] = dark
    else grid.dark[8]![14 - i] = dark
    // and the split copy shared by the other two finders
    if (i < 8) grid.dark[8]![size - 1 - i] = dark
    else grid.dark[size - 15 + i]![8] = dark
  }
}

/** Zigzag up and down the column pairs, right to left, skipping the vertical timing column. */
function writeData(grid: Grid, codewords: readonly number[]) {
  const { size } = grid
  let bit = 0
  const nextBit = () => {
    const byte = codewords[bit >> 3]
    const value = byte === undefined ? 0 : (byte >> (7 - (bit & 7))) & 1
    bit++
    return value === 1
  }
  let upward = true
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5 // the timing column is not part of any pair
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step
      for (const col of [right, right - 1]) {
        if (grid.fixed[row]![col]) continue
        grid.dark[row]![col] = nextBit()
      }
    }
    upward = !upward
  }
}

const MASKS: ((row: number, col: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
]

/** The four penalties of ISO/IEC 18004 §8.8.2, summed: lower is the mask a scanner reads best. */
function penalty(grid: Grid): number {
  const { size, dark } = grid
  let score = 0

  const runPenalty = (get: (a: number, b: number) => boolean) => {
    for (let a = 0; a < size; a++) {
      let run = 1
      for (let b = 1; b < size; b++) {
        if (get(a, b) === get(a, b - 1)) run++
        else {
          if (run >= 5) score += 3 + (run - 5)
          run = 1
        }
      }
      if (run >= 5) score += 3 + (run - 5)
    }
  }
  runPenalty((r, c) => dark[r]![c]!)
  runPenalty((c, r) => dark[r]![c]!)

  for (let r = 0; r < size - 1; r++)
    for (let c = 0; c < size - 1; c++) {
      const v = dark[r]![c]!
      if (v === dark[r]![c + 1] && v === dark[r + 1]![c] && v === dark[r + 1]![c + 1]) score += 3
    }

  const FINDER_LIKE = [true, false, true, true, true, false, true, false, false, false, false]
  const matches = (get: (i: number) => boolean, at: number) => {
    for (let i = 0; i < 11; i++) if (get(at + i) !== FINDER_LIKE[i]) return false
    return true
  }
  for (let a = 0; a < size; a++)
    for (let b = 0; b + 11 <= size; b++) {
      if (matches((i) => dark[a]![i]!, b)) score += 40
      if (matches((i) => dark[i]![a]!, b)) score += 40
      // the same run read the other way round
      if (matches((i) => dark[a]![b + 10 - (i - b)]!, b)) score += 40
      if (matches((i) => dark[b + 10 - (i - b)]![a]!, b)) score += 40
    }

  let darkCount = 0
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (dark[r]![c]) darkCount++
  const percent = (darkCount * 100) / (size * size)
  score += Math.floor(Math.abs(percent - 50) / 5) * 10
  return score
}

/**
 * The module matrix for `text`: `matrix[row][col]` is true where the module is dark.
 *
 * Throws when the text is longer than version 14 at level M holds (362 bytes). Callers that can
 * carry on without a picture should catch it rather than growing this file.
 *
 * `options.mask` pins the mask pattern instead of picking the one that scores best. Only the test
 * passes it: every mask produces a symbol a scanner reads, so which one is chosen is a quality
 * heuristic and encoders differ over it — pinning is what lets the whole matrix be compared with
 * another implementation. Leave it out everywhere else.
 */
export function qrMatrix(text: string, options: { mask?: number } = {}): boolean[][] {
  const bytes = new TextEncoder().encode(text)
  const version = versionFor(bytes.length)
  if (version === 0)
    throw new RangeError(`${bytes.length} bytes is more than this QR encoder builds (362 at most)`)

  const codewords = interleave(dataCodewords(bytes, version), version)
  let best: Grid | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (let mask = 0; mask < 8; mask++) {
    if (options.mask !== undefined && options.mask !== mask) continue
    const grid = blankGrid(version)
    drawFunctionPatterns(grid, version)
    writeData(grid, codewords)
    const apply = MASKS[mask]!
    for (let r = 0; r < grid.size; r++)
      for (let c = 0; c < grid.size; c++)
        if (!grid.fixed[r]![c] && apply(r, c)) grid.dark[r]![c] = !grid.dark[r]![c]
    writeFormat(grid, mask)
    const score = penalty(grid)
    if (score < bestScore) {
      bestScore = score
      best = grid
    }
  }
  return best!.dark
}

/**
 * One SVG path covering every dark module, for a `viewBox` of `size + 2 * quiet` units.
 *
 * A path rather than a rectangle per module: a version 6 code is 1,700 elements, and the DOM cost
 * of that is visible when the dialog opens.
 */
export function qrPath(matrix: readonly (readonly boolean[])[], quiet = 4): string {
  const parts: string[] = []
  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r]!
    let c = 0
    while (c < row.length) {
      if (!row[c]) {
        c++
        continue
      }
      let width = 1
      while (row[c + width]) width++
      parts.push(`M${c + quiet} ${r + quiet}h${width}v1h-${width}z`)
      c += width
    }
  }
  return parts.join('')
}
