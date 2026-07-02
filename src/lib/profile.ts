import type { RoutePoint } from '../types'

/** Resamples an elevation profile into evenly spaced distance bands. */
export function resampleProfile(points: RoutePoint[], requestedBands: number) {
  if (points.length < 2) return points
  const bands = Math.max(1, Math.round(requestedBands))
  const start = points[0].distanceKm
  const end = points.at(-1)!.distanceKm
  if (end <= start) return points

  let sourceIndex = 0
  return Array.from({ length: bands + 1 }, (_, index) => {
    const distanceKm = start + ((end - start) * index) / bands
    while (sourceIndex < points.length - 2 && points[sourceIndex + 1].distanceKm < distanceKm) sourceIndex += 1
    const left = points[sourceIndex]
    const right = points[Math.min(sourceIndex + 1, points.length - 1)]
    const span = right.distanceKm - left.distanceKm
    const ratio = span > 0 ? (distanceKm - left.distanceKm) / span : 0
    return {
      lat: left.lat + (right.lat - left.lat) * ratio,
      lon: left.lon + (right.lon - left.lon) * ratio,
      elevation: (left.elevation ?? 0) + ((right.elevation ?? 0) - (left.elevation ?? 0)) * ratio,
      distanceKm,
    }
  })
}
