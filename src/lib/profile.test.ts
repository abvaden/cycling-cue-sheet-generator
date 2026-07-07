import { describe, expect, it } from 'vitest'
import { interpolateRoutePoint, profilePointsInRange, resampleProfile } from './profile'

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

  it('interpolates route points at arbitrary distances', () => {
    expect(interpolateRoutePoint(points, 0.25)).toMatchObject({
      distanceKm: 0.25,
      elevation: 125,
      lat: 0,
      lon: 0.25,
    })
  })

  it('clips profile ranges with interpolated boundaries', () => {
    const clipped = profilePointsInRange(points, 0.25, 0.75)
    expect(clipped).toHaveLength(2)
    expect(clipped.map((point) => point.elevation)).toEqual([125, 175])
  })

  it('keeps interior points inside clipped profile ranges', () => {
    const clipped = profilePointsInRange(
      [
        ...points,
        { lat: 0, lon: 2, elevation: 300, distanceKm: 2 },
      ],
      0.5,
      1.5,
    )
    expect(clipped.map((point) => point.distanceKm)).toEqual([0.5, 1, 1.5])
  })
})
