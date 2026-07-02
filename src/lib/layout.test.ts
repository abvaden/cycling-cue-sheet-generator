import { describe, expect, it } from 'vitest'
import { flowGrid, nextGridPosition, sheetGridSize } from './layout'

const item = (w: number, h = 3) => ({ grid: { x: 0, y: 0, w, h } })

describe('flowing cue layout', () => {
  it('fills available columns before wrapping vertically', () => {
    const result = flowGrid([item(4), item(5), item(3), item(7), item(6)])
    expect(result.map(({ grid }) => [grid.x, grid.y])).toEqual([
      [0, 0], [4, 0], [9, 0], [0, 3], [0, 6],
    ])
  })

  it('uses the tallest control to position the next row', () => {
    const result = flowGrid([item(6, 2), item(6, 5), item(4, 2)])
    expect(result[2].grid).toMatchObject({ x: 0, y: 5 })
  })

  it('places new controls in the next available space', () => {
    expect(nextGridPosition([item(4), item(4)], 4, 3)).toMatchObject({ x: 8, y: 0 })
    expect(nextGridPosition([item(8), item(4)], 6, 3)).toMatchObject({ x: 0, y: 3 })
  })
})

describe('physical sheet grid', () => {
  it('derives 10 mm cells from sheet geometry and margins', () => {
    expect(sheetGridSize({ width: 200, height: 70, dimensionUnit: 'mm', units: 'metric', marginMm: 3 })).toEqual({ columns: 19, rows: 6 })
  })

  it('uses the same physical grid for inch dimensions', () => {
    expect(sheetGridSize({ width: 8, height: 3, dimensionUnit: 'in', units: 'imperial', marginMm: 0 })).toEqual({ columns: 20, rows: 7 })
  })
})
