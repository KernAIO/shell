import { describe, expect, it } from 'vitest'
import fixtures from './qr.fixtures.json' with { type: 'json' }
import { QR_MAX_VERSION, qrMatrix, qrPath } from './qr.js'

/**
 * A QR that is wrong by one module still looks exactly like a QR, so this compares whole matrices
 * against a reference encoder rather than checking anything by eye.
 *
 * `qr.fixtures.json` was produced with `qrcode` 8.x for Python, which is not a translation of this
 * file — one case per version 1 to 14 at error-correction level M in byte mode, so a mistake in a
 * capacity, a block split, an alignment centre, the format bits or the version bits cannot hide in
 * a version nothing exercises:
 *
 *     q = qrcode.QRCode(error_correction=ERROR_CORRECT_M, border=0, mask_pattern=mask)
 *     q.add_data(QRData(text.encode('utf-8'), mode=MODE_8BIT_BYTE))
 *
 * The fixture's mask is passed back in, because **which** mask an encoder picks is a quality
 * heuristic rather than part of the symbol: all eight produce something a scanner reads, and
 * implementations disagree about how to score them (`qrcode` evaluates the penalty with the format
 * and version information blanked, ISO/IEC 18004 scores the finished symbol, which is what this
 * file does). Pinning it is what makes the rest of the matrix comparable module for module.
 *
 * The other half of the evidence cannot live in a unit test: the auto-masked output of every case
 * below, plus four payloads that are not fixtures at all, was rendered and read back with OpenCV's
 * QR decoder — 21 of 21 decoded to exactly the text that went in.
 */
describe('qrMatrix', () => {
  for (const fixture of fixtures) {
    const label = fixture.text.startsWith('otpauth:')
      ? `an otpauth URI (version ${fixture.version})`
      : `${fixture.text.length} bytes (version ${fixture.version})`

    it(`matches the reference encoder for ${label}`, () => {
      const matrix = qrMatrix(fixture.text, { mask: fixture.mask })
      const rows = matrix.map((row) => row.map((dark) => (dark ? '1' : '0')).join(''))
      expect(rows).toEqual(fixture.matrix)
    })
  }

  it('picks the smallest version that holds the text', () => {
    // one byte over version 1's 14-byte capacity at level M has to move up
    expect(qrMatrix('x'.repeat(14)).length).toBe(21)
    expect(qrMatrix('x'.repeat(15)).length).toBe(25)
  })

  it('chooses a mask on its own, and always one of the eight', () => {
    const auto = qrMatrix(fixtures[0]!.text)
    const eight = Array.from({ length: 8 }, (_, mask) => qrMatrix(fixtures[0]!.text, { mask }))
    expect(eight.some((candidate) => JSON.stringify(candidate) === JSON.stringify(auto))).toBe(true)
  })

  it('refuses text longer than it can encode instead of drawing something unreadable', () => {
    expect(QR_MAX_VERSION).toBe(14)
    expect(() => qrMatrix('x'.repeat(363))).toThrow(RangeError)
  })

  it('encodes non-ASCII as UTF-8', () => {
    // the Persian fixture is 71 characters and 91 bytes, so it needs a bigger version than its
    // length suggests; that it still matches the reference is the assertion above
    const persian = fixtures.find((f) => f.text.includes('کرن'))
    expect(persian).toBeDefined()
    expect(new TextEncoder().encode(persian!.text).length).toBeGreaterThan(persian!.text.length)
  })
})

describe('qrPath', () => {
  it('draws one run per horizontal stretch of dark modules', () => {
    const path = qrPath(
      [
        [true, true, false],
        [false, false, true],
      ],
      0,
    )
    expect(path).toBe('M0 0h2v1h-2zM2 1h1v1h-1z')
  })

  it('offsets every run by the quiet zone', () => {
    expect(qrPath([[true]], 4)).toBe('M4 4h1v1h-1z')
  })

  it('draws nothing for an empty matrix', () => {
    expect(qrPath([])).toBe('')
  })
})
