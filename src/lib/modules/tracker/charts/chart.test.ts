import { describe, expect, it } from 'vitest'
import { barLayout, gridLines, linePath, niceMax } from './chart'

describe('niceMax', () => {
  it('rounds up to a number somebody would choose', () => {
    expect(niceMax([3])).toBe(5)
    expect(niceMax([12])).toBe(20)
    expect(niceMax([21])).toBe(25)
    expect(niceMax([64])).toBe(100)
  })

  it('never returns zero, so nothing divides by it', () => {
    expect(niceMax([])).toBe(1)
    expect(niceMax([0, 0])).toBe(1)
    expect(niceMax([-4])).toBe(1)
  })

  it('ignores values that are not numbers', () => {
    expect(niceMax([Number.NaN, 3])).toBe(5)
  })
})

describe('gridLines', () => {
  it('includes both ends', () => {
    expect(gridLines(20, 4)).toEqual([0, 5, 10, 15, 20])
  })
})

describe('linePath', () => {
  it('draws from left to right, with zero at the bottom', () => {
    // height 100, max 10: a value of 10 is at y=0 and 0 is at y=100.
    expect(linePath([10, 0], 10, 200, 100)).toBe('M 0 0 L 200 100')
  })

  it('draws a single measurement as a flat line, not as nothing', () => {
    // A cycle on its first day has one point; an empty chart would read as "no data".
    expect(linePath([5], 10, 200, 100)).toBe('M 0 50 L 200 50')
  })

  it('has nothing to draw for nothing', () => {
    expect(linePath([], 10, 200, 100)).toBe('')
  })

  it('clamps a negative value to the floor rather than drawing off the chart', () => {
    expect(linePath([-5], 10, 200, 100)).toBe('M 0 100 L 200 100')
  })
})

describe('barLayout', () => {
  it('splits the width into groups with room between them', () => {
    const { groupWidth, barWidth } = barLayout(4, 2, 400)
    expect(groupWidth).toBe(100)
    expect(barWidth).toBe(37.5)
  })

  it('keeps a bar visible however many there are', () => {
    expect(barLayout(200, 2, 400).barWidth).toBe(2)
  })
})
