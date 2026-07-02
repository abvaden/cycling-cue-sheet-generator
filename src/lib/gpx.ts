import type { Route, RoutePoint } from '../types'

const earthRadiusKm = 6371

export function haversineKm(a: Pick<RoutePoint, 'lat' | 'lon'>, b: Pick<RoutePoint, 'lat' | 'lon'>) {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(s))
}

export function parseGpx(xml: string, fallbackName = 'Untitled route'): Route {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('This file is not valid GPX XML.')

  const nodes = [...doc.querySelectorAll('trkpt, rtept')]
  if (nodes.length < 2) throw new Error('The GPX needs at least two route or track points.')

  let distanceKm = 0
  let elevationGainM = 0
  const points: RoutePoint[] = nodes.map((node, index) => {
    const lat = Number(node.getAttribute('lat'))
    const lon = Number(node.getAttribute('lon'))
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('A route point has invalid coordinates.')
    const eleNode = node.querySelector('ele')
    const parsedEle = eleNode ? Number(eleNode.textContent) : undefined
    const elevation = Number.isFinite(parsedEle) ? parsedEle : undefined
    const previous = index ? nodes[index - 1] : undefined
    if (previous) {
      distanceKm += haversineKm(
        { lat: Number(previous.getAttribute('lat')), lon: Number(previous.getAttribute('lon')) },
        { lat, lon },
      )
    }
    const previousEleNode = previous?.querySelector('ele')
    const previousEle = previousEleNode ? Number(previousEleNode.textContent) : undefined
    if (elevation !== undefined && previousEle !== undefined && elevation > previousEle) elevationGainM += elevation - previousEle
    return { lat, lon, elevation, distanceKm }
  })

  const name = doc.querySelector('metadata > name, trk > name, rte > name')?.textContent?.trim() || fallbackName
  return {
    name,
    points,
    distanceKm,
    elevationGainM,
    hasElevation: points.every((point) => point.elevation !== undefined),
  }
}

export async function parseGpxFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.gpx')) throw new Error('Choose a .gpx route file.')
  return parseGpx(await file.text(), file.name.replace(/\.gpx$/i, ''))
}
