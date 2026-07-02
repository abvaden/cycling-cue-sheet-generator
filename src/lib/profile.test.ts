import { describe, expect, it } from 'vitest'
import { resampleProfile } from './profile'

const points = [
  { lat: 0, lon: 0, elevation: 100, distanceKm: 0 },
  { lat: 0, lon: 1, elevation: 200, distanceKm: 1 },
]

describe('profile resolution', () => {
  it('creates the requested number of grade bands', () => {
    const sampled = resampleProfile(points, 4)
    expect(sampled).toHaveLength(5)
    expect(sampled.map((point) => point.elevation)).toEqual([100, 125, 150, 175, 200])
  })

  it('enforces at least one band', () => expect(resampleProfile(points, 0)).toHaveLength(2))
})
