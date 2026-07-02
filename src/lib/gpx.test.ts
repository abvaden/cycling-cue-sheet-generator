import { describe, expect, it } from 'vitest'
import { haversineKm, parseGpx } from './gpx'

const gpx = `<?xml version="1.0"?><gpx version="1.1"><metadata><name>Morning Loop</name></metadata><trk><trkseg>
  <trkpt lat="40.0000" lon="-105.0000"><ele>1600</ele></trkpt>
  <trkpt lat="40.0100" lon="-105.0000"><ele>1650</ele></trkpt>
  <trkpt lat="40.0200" lon="-105.0000"><ele>1635</ele></trkpt>
</trkseg></trk></gpx>`

describe('GPX parsing', () => {
  it('derives cumulative distance and positive elevation gain', () => {
    const route = parseGpx(gpx)
    expect(route.name).toBe('Morning Loop')
    expect(route.points).toHaveLength(3)
    expect(route.distanceKm).toBeGreaterThan(2.1)
    expect(route.elevationGainM).toBe(50)
    expect(route.hasElevation).toBe(true)
  })

  it('allows routes without elevation', () => {
    const route = parseGpx('<gpx><rte><rtept lat="1" lon="1"/><rtept lat="1.1" lon="1.1"/></rte></gpx>')
    expect(route.hasElevation).toBe(false)
    expect(route.elevationGainM).toBe(0)
  })

  it('rejects malformed and empty routes', () => {
    expect(() => parseGpx('<gpx>')).toThrow(/valid GPX/)
    expect(() => parseGpx('<gpx></gpx>')).toThrow(/at least two/)
  })

  it('calculates known approximate distances', () => {
    expect(haversineKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111.19, 1)
  })
})
