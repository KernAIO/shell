import { describe, expect, it } from 'vitest'
import { COLUMNS, overlaps } from './grid'
import { DEFAULT_PRESET_ID, expandPreset, PRESETS, preset } from './presets'

let n = 0
const ids = () => `id-${n++}`

describe('presets', () => {
  it('every preset has a unique id and at least one card', () => {
    const ids = PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const p of PRESETS) expect(p.entries.length).toBeGreaterThan(0)
  })

  it('the default preset exists, or nobody has a home page', () => {
    expect(PRESETS.some((p) => p.id === DEFAULT_PRESET_ID)).toBe(true)
  })

  it('falls back rather than returning nothing for an id it does not know', () => {
    expect(preset('a-preset-from-a-later-version').id).toBe(DEFAULT_PRESET_ID)
  })
})

describe('expandPreset', () => {
  it('packs every preset inside the grid with no overlaps', () => {
    for (const p of PRESETS) {
      const items = expandPreset(p.id, ids)
      expect(items).toHaveLength(p.entries.length)
      for (const it of items) {
        expect(it.x).toBeGreaterThanOrEqual(0)
        expect(it.x + it.w).toBeLessThanOrEqual(COLUMNS)
      }
      expect(items.every((a, ai) => items.every((b, bi) => ai === bi || !overlaps(a, b)))).toBe(true)
    }
  })

  it('drops widgets a workspace does not have instead of leaving holes', () => {
    const items = expandPreset('my-work', ids, (w) => w.startsWith('core.'))
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((i) => i.widget.startsWith('core.'))).toBe(true)
    expect(items.every((i) => i.x + i.w <= COLUMNS)).toBe(true)
  })

  it('carries the entry settings onto the placed card', () => {
    const items = expandPreset('my-work', ids)
    expect(items.find((i) => i.widget === 'tracker.issues')?.settings).toMatchObject({
      preset: 'assigned',
    })
  })
})
