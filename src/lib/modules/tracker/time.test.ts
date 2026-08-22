import { describe, expect, it } from 'vitest'
import { parseDuration } from './time'

describe('parseDuration', () => {
  it('reads a bare number as hours, because that is what people mean', () => {
    expect(parseDuration('2')).toBe(7200)
    expect(parseDuration('0.5')).toBe(1800)
  })

  it('reads hours and minutes, together or apart', () => {
    expect(parseDuration('2h')).toBe(7200)
    expect(parseDuration('90m')).toBe(5400)
    expect(parseDuration('1h30m')).toBe(5400)
    expect(parseDuration('2h 15m')).toBe(8100)
  })

  it('does not care about case or spacing', () => {
    expect(parseDuration('  1H 30M ')).toBe(5400)
  })

  it('refuses what is not an amount of time', () => {
    // Silently reading "half an hour" as nothing would log nothing and say it worked.
    expect(parseDuration('half an hour')).toBeNull()
    expect(parseDuration('')).toBeNull()
    expect(parseDuration('0')).toBeNull()
    expect(parseDuration('0h')).toBeNull()
    expect(parseDuration('2 hours')).toBeNull()
    expect(parseDuration('-1h')).toBeNull()
  })
})
