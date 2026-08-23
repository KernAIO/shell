import { describe, expect, it } from 'vitest'
import {
  addItem,
  COLUMNS,
  cellAt,
  compact,
  findSlot,
  moveItem,
  normalise,
  nudge,
  overlaps,
  type Placed,
  project,
  readingOrder,
  removeItem,
  reorder,
  resizeItem,
  stepSize,
} from './grid'

const p = (i: string, x: number, y: number, w = 4, h = 2): Placed => ({ i, x, y, w, h })

/** No two cards may ever share a cell. Every mutation is checked against this. */
const noOverlaps = (items: Placed[]) =>
  items.every((a, ai) => items.every((b, bi) => ai === bi || !overlaps(a, b)))

describe('overlaps', () => {
  it('is false for cards that merely touch', () => {
    expect(overlaps(p('a', 0, 0), p('b', 4, 0))).toBe(false)
    expect(overlaps(p('a', 0, 0), p('b', 0, 2))).toBe(false)
  })
  it('is true for any shared cell', () => {
    expect(overlaps(p('a', 0, 0), p('b', 3, 1))).toBe(true)
  })
})

describe('compact', () => {
  it('pulls cards up to rest on each other', () => {
    const out = compact([p('a', 0, 5), p('b', 0, 9)])
    expect(out.map((i) => [i.i, i.y])).toEqual([
      ['a', 0],
      ['b', 2],
    ])
  })

  it('is stable: cards in the same row keep their left-to-right order', () => {
    const out = compact([p('b', 4, 3), p('a', 0, 3)])
    expect(out.map((i) => i.i)).toEqual(['a', 'b'])
  })

  it('does not let a card fall through one beside it', () => {
    const out = compact([p('a', 0, 0), p('b', 4, 4)])
    expect(out.find((i) => i.i === 'b')?.y).toBe(0)
  })
})

describe('findSlot', () => {
  it('fills the gap beside an existing card before starting a new row', () => {
    expect(findSlot([p('a', 0, 0)], 4, 2)).toEqual({ x: 4, y: 0 })
  })

  it('starts a new row when the current one is full', () => {
    const full = [p('a', 0, 0), p('b', 4, 0), p('c', 8, 0)]
    expect(findSlot(full, 4, 2)).toEqual({ x: 0, y: 2 })
  })

  it('never returns a slot that would hang off the right edge', () => {
    const slot = findSlot([], 12, 2)
    expect(slot.x + 12).toBeLessThanOrEqual(COLUMNS)
  })
})

describe('moveItem', () => {
  it('gives the dropped card the slot and pushes the occupant down', () => {
    const out = moveItem([p('a', 0, 0), p('b', 0, 2)], 'b', { x: 0, y: 0 })
    expect(out.find((i) => i.i === 'b')?.y).toBe(0)
    expect(out.find((i) => i.i === 'a')?.y).toBe(2)
    expect(noOverlaps(out)).toBe(true)
  })

  it('clamps a card dragged past the right edge instead of losing it', () => {
    const out = moveItem([p('a', 0, 0)], 'a', { x: 99, y: 0 })
    const a = out.find((i) => i.i === 'a')!
    expect(a.x + a.w).toBeLessThanOrEqual(COLUMNS)
  })

  it('leaves a layout with no overlaps however far a card is thrown', () => {
    let items = [p('a', 0, 0), p('b', 4, 0), p('c', 8, 0), p('d', 0, 2)]
    for (const to of [
      { x: 4, y: 0 },
      { x: 0, y: 0 },
      { x: 8, y: 1 },
      { x: 2, y: 3 },
    ]) {
      items = moveItem(items, 'd', to)
      expect(noOverlaps(items)).toBe(true)
    }
  })
})

describe('resizeItem', () => {
  it('displaces neighbours and stays inside the grid', () => {
    const out = resizeItem([p('a', 0, 0), p('b', 4, 0)], 'a', { w: 12, h: 2 })
    expect(out.find((i) => i.i === 'a')?.w).toBe(12)
    expect(noOverlaps(out)).toBe(true)
  })

  it('pulls a card left when growing it would hang off the edge', () => {
    const out = resizeItem([p('a', 8, 0, 4, 2)], 'a', { w: 8, h: 2 })
    const a = out.find((i) => i.i === 'a')!
    expect(a.x + a.w).toBeLessThanOrEqual(COLUMNS)
  })
})

describe('nudge', () => {
  it('returns the same reference when the step is impossible', () => {
    const items = [p('a', 0, 0)]
    expect(nudge(items, 'a', 'left')).toBe(items)
    expect(nudge(items, 'a', 'up')).toBe(items)
  })

  it('moves the card when there is room', () => {
    const items = [p('a', 0, 0)]
    expect(nudge(items, 'a', 'right').find((i) => i.i === 'a')?.x).toBe(1)
  })
})

describe('reorder', () => {
  it('swaps with the neighbour in reading order', () => {
    const out = reorder([p('a', 0, 0), p('b', 4, 0)], 'b', -1)
    expect(readingOrder(out).map((i) => i.i)).toEqual(['b', 'a'])
  })

  it('does nothing at the ends', () => {
    const items = [p('a', 0, 0), p('b', 4, 0)]
    expect(reorder(items, 'a', -1)).toBe(items)
    expect(reorder(items, 'b', 1)).toBe(items)
  })

  it('still works where every direction is blocked, which is the point of it', () => {
    const dense = [p('a', 0, 0), p('b', 4, 0), p('c', 8, 0)]
    const out = reorder(dense, 'c', -1)
    expect(readingOrder(out).map((i) => i.i)).toEqual(['a', 'c', 'b'])
  })
})

describe('project', () => {
  const wide = [p('a', 0, 0, 6, 2), p('b', 6, 0, 6, 2), p('c', 0, 2, 12, 2)]

  it('halves geometry for six columns and keeps it inside them', () => {
    const out = project(wide, 6)
    expect(noOverlaps(out)).toBe(true)
    for (const it of out) expect(it.x + it.w).toBeLessThanOrEqual(6)
  })

  it('stacks into one column in reading order', () => {
    const out = project(wide, 1)
    expect(out.map((i) => i.i)).toEqual(['a', 'b', 'c'])
    for (const it of out) expect([it.x, it.w]).toEqual([0, 1])
  })

  it('preserves reading order at every width', () => {
    const order = readingOrder(wide).map((i) => i.i)
    for (const cols of [12, 6, 1] as const) {
      expect(readingOrder(project(wide, cols)).map((i) => i.i)).toEqual(order)
    }
  })
})

describe('cellAt', () => {
  const box = { width: 1200, rowHeight: 84, gap: 12 }

  it('maps a pointer to a column', () => {
    expect(cellAt({ x: 0, y: 0 }, box).x).toBe(0)
    expect(cellAt({ x: 1190, y: 0 }, box).x).toBe(11)
  })

  it('mirrors the column under RTL, because the grid already did', () => {
    expect(cellAt({ x: 0, y: 0 }, box, 'rtl').x).toBe(11)
    expect(cellAt({ x: 1190, y: 0 }, box, 'rtl').x).toBe(0)
  })

  it('never returns a negative row', () => {
    expect(cellAt({ x: 0, y: -500 }, box).y).toBe(0)
  })
})

describe('normalise', () => {
  it('drops a duplicate id', () => {
    expect(normalise([p('a', 0, 0), p('a', 4, 0)])).toHaveLength(1)
  })

  it('repairs a layout that overlaps itself', () => {
    const out = normalise([p('a', 0, 0), p('b', 0, 0), p('c', 1, 0)])
    expect(out).toHaveLength(3)
    expect(noOverlaps(out)).toBe(true)
  })

  it('clamps geometry that is out of range or nonsense', () => {
    const out = normalise([{ i: 'a', x: 99, y: -4, w: 40, h: 0 }])
    const a = out[0]!
    expect(a.w).toBeLessThanOrEqual(COLUMNS)
    expect(a.x + a.w).toBeLessThanOrEqual(COLUMNS)
    expect(a.y).toBeGreaterThanOrEqual(0)
    expect(a.h).toBeGreaterThanOrEqual(1)
  })
})

describe('addItem and removeItem', () => {
  it('places a new card in the first gap', () => {
    const out = addItem([p('a', 0, 0)], { i: 'b', w: 4, h: 2 })
    expect(out.find((i) => i.i === 'b')).toMatchObject({ x: 4, y: 0 })
  })

  it('closes the gap when a card is removed', () => {
    const out = removeItem([p('a', 0, 0), p('b', 0, 2)], 'a')
    expect(out.find((i) => i.i === 'b')?.y).toBe(0)
  })
})

describe('stepSize', () => {
  it('stays inside what the widget declared', () => {
    expect(stepSize(['m', 'l'], 'm', -1)).toBe('m')
    expect(stepSize(['m', 'l'], 'l', 1)).toBe('l')
    expect(stepSize(['m', 'l'], 'm', 1)).toBe('l')
  })
  it('skips sizes a widget does not offer', () => {
    expect(stepSize(['s', 'xl'], 's', 1)).toBe('xl')
  })
})
