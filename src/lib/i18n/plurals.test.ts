import { describe, expect, it } from 'vitest'
import { members_count, tracker_issues_count } from '../paraglide/messages.js'
import type { Locale } from '../paraglide/runtime.js'

/**
 * Plurals, per locale, against the compiled catalogue.
 *
 * These messages were flat strings until they were not, and a flat string is wrong in every
 * language that inflects: English said "1 issues" for a year. The failure mode after converting
 * them is worse and quieter — when no branch matches the count, Paraglide returns the message
 * *key*, so a reader sees `tracker_issues_count` where a sentence belongs. Arabic has six plural
 * categories and reaches that state on the number two.
 */
const count = (n: number, locale: Locale) => tracker_issues_count({ count: n }, { locale })

describe('plural variants', () => {
  it('inflects English on one', () => {
    expect(count(1, 'en')).toBe('1 issue')
    expect(count(2, 'en')).toBe('2 issues')
  })

  it('does not inflect Persian, and writes its digits', () => {
    // A Persian noun does not change after a numeral, so both categories carry the same wording —
    // but both must exist, or `one` falls through to the key.
    expect(count(1, 'fa')).toBe('۱ کار')
    expect(count(2, 'fa')).toBe('۲ کار')
    expect(count(11, 'fa')).toBe('۱۱ کار')
  })

  it('covers every Arabic category, including the dual', () => {
    expect(count(0, 'ar')).toBe('لا مهام')
    expect(count(1, 'ar')).toBe('مهمة واحدة')
    expect(count(2, 'ar')).toBe('مهمتان')
    expect(count(3, 'ar')).toBe('3 مهام')
    expect(count(11, 'ar')).toBe('11 مهمة')
  })

  it('inflects German on one', () => {
    expect(count(1, 'de')).toBe('1 Vorgang')
    expect(count(2, 'de')).toBe('2 Vorgänge')
  })

  it('does not inflect Turkish after a numeral', () => {
    // Like Persian, a Turkish noun stays singular after a number — both categories, same wording.
    expect(count(1, 'tr')).toBe('1 iş')
    expect(count(2, 'tr')).toBe('2 iş')
  })

  it('never renders a message key', () => {
    // The regression that matters: a key on screen instead of a sentence.
    for (const locale of ['en', 'fa', 'ar', 'de', 'tr'] as const) {
      for (const n of [0, 1, 2, 3, 6, 11, 100, 101]) {
        expect(count(n, locale)).not.toContain('tracker_issues_count')
        expect(members_count({ count: n }, { locale })).not.toContain('members_count')
      }
    }
  })
})
