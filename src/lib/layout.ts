import type { Cue, GridPosition, SheetSettings } from '../types'
import { toMm } from '../types'

export const GRID_UNIT_MM = 10

export function sheetGridSize(sheet: SheetSettings) {
  const usableWidth = Math.max(GRID_UNIT_MM, toMm(sheet.width, sheet.dimensionUnit) - sheet.marginMm * 2)
  const usableHeight = Math.max(GRID_UNIT_MM, toMm(sheet.height, sheet.dimensionUnit) - sheet.marginMm * 2)
  return { columns: Math.max(1, Math.floor(usableWidth / GRID_UNIT_MM)), rows: Math.max(1, Math.floor(usableHeight / GRID_UNIT_MM)) }
}

/** Packs controls like a wrapping row layout while retaining each control's size. */
export function flowGrid<T extends Pick<Cue, 'grid'>>(items: T[], columns = 12): T[] {
  let x = 0
  let y = 0
  let rowHeight = 0

  return items.map((item) => {
    const w = Math.max(1, Math.min(columns, item.grid.w))
    const h = Math.max(1, item.grid.h)

    if (x > 0 && x + w > columns) {
      x = 0
      y += rowHeight
      rowHeight = 0
    }

    const grid: GridPosition = { ...item.grid, x, y, w, h }
    x += w
    rowHeight = Math.max(rowHeight, h)
    return { ...item, grid }
  })
}

export function nextGridPosition(items: Pick<Cue, 'grid'>[], width = 6, height = 3, columns = 12) {
  const marker = { grid: { x: 0, y: 0, w: width, h: height } }
  return flowGrid([...items, marker], columns).at(-1)!.grid
}
