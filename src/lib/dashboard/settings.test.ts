import type { WidgetSettingField } from '@kernhq/ui'
import { describe, expect, it } from 'vitest'
import { defaultsOf, resolveSettings, settingsScope } from './settings'

const fields: WidgetSettingField[] = [
  { kind: 'number', key: 'limit', label: 'Rows', default: 6, min: 3, max: 12 },
  { kind: 'select', key: 'project', label: 'Project', default: null, nullable: true },
  { kind: 'toggle', key: 'compact', label: 'Compact', default: false },
  { kind: 'text', key: 'title', label: 'Title', default: '', maxLength: 5 },
]

describe('resolveSettings', () => {
  it('uses the declared defaults when nothing was saved', () => {
    expect(resolveSettings(fields, undefined)).toEqual(defaultsOf(fields))
  })

  it('lets a saved value win', () => {
    expect(resolveSettings(fields, { limit: 10 }).limit).toBe(10)
  })

  it('clamps a number to what the field declared', () => {
    expect(resolveSettings(fields, { limit: 999 }).limit).toBe(12)
    expect(resolveSettings(fields, { limit: -5 }).limit).toBe(3)
  })

  it('truncates text to its maximum', () => {
    expect(resolveSettings(fields, { title: 'far too long' }).title).toBe('far t')
  })

  it('ignores a saved value of the wrong type rather than passing it on', () => {
    expect(resolveSettings(fields, { limit: 'eight' as never }).limit).toBe(6)
  })

  it('drops a key the widget no longer declares', () => {
    const out = resolveSettings(fields, { limit: 8, groupBy: 'status' })
    expect(out).not.toHaveProperty('groupBy')
    expect(out.limit).toBe(8)
  })

  it('keeps an explicit null for a nullable select', () => {
    expect(resolveSettings(fields, { project: null }).project).toBeNull()
  })
})

describe('settingsScope', () => {
  it('is stable however the keys were ordered', () => {
    expect(settingsScope({ b: 2, a: 1 })).toBe(settingsScope({ a: 1, b: 2 }))
  })

  it('changes when any value changes, which is what makes the query refetch', () => {
    expect(settingsScope({ project: 'a' })).not.toBe(settingsScope({ project: 'b' }))
    expect(settingsScope({ project: null })).not.toBe(settingsScope({ project: 'b' }))
  })

  it('handles nothing at all', () => {
    expect(settingsScope(undefined)).toBe('')
    expect(settingsScope({})).toBe('')
  })
})
