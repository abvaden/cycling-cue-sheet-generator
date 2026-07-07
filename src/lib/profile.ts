import type { RoutePoint } from '../types'

export function interpolateRoutePoint(points: RoutePoint[], distanceKm: number) {
  if (!points.length) return undefined
  if (distanceKm <= points[0].distanceKm) return { ...points[0], distanceKm }
  if (distanceKm >= points.at(-1)!.distanceKm) return { ...points.at(-1)!, distanceKm }

  const rightIndex = points.findIndex((point) => point.distanceKm >= distanceKm)
  const left = points[Math.max(0, rightIndex - 1)]
  const right = points[rightIndex]
  const span = right.distanceKm - left.distanceKm
  const ratio = span > 0 ? (distanceKm - left.distanceKm) / span : 0
  return {
    lat: left.lat + (right.lat - left.lat) * ratio,
    lon: left.lon + (right.lon - left.lon) * ratio,
    elevation: (left.elevation ?? 0) + ((right.elevation ?? 0) - (left.elevation ?? 0)) * ratio,
    distanceKm,
  }
}

export function profilePointsInRange(points: RoutePoint[], startKm: number, endKm: number) {
  if (points.length < 2 || endKm <= startKm) return []
  const start = interpolateRoutePoint(points, startKm)
  const end = interpolateRoutePoint(points, endKm)
  if (!start || !end) return []

  const interior = points.filter((point) => point.distanceKm > startKm && point.distanceKm < endKm)
  return [start, ...interior, end]
}

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
