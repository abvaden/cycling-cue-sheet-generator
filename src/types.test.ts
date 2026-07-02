import { describe, expect, it } from 'vitest'
import { formatDistance, formatElevation, toMm } from './types'

describe('measurement helpers', () => {
  it('converts physical dimensions', () => expect(toMm(2, 'in')).toBeCloseTo(50.8))
  it('formats route units', () => {
    expect(formatDistance(10, 'metric')).toBe('10.0 km')
    expect(formatDistance(10, 'imperial')).toBe('6.2 mi')
    expect(formatDistance(10, 'imperial', false)).toBe('6.2')
    expect(formatElevation(1000, 'imperial')).toBe('3,281 ft')
  })
})
