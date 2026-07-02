import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { Cue, Route } from '../types'
import 'leaflet/dist/leaflet.css'

interface Props {
  route: Route
  cues: Cue[]
  onPick: (distanceKm: number) => void
}

export function RouteMap({ route, cues, onPick }: Props) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!host.current) return
    const map = L.map(host.current, { zoomControl: true, attributionControl: true })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)
    const latLngs = route.points.map((point) => L.latLng(point.lat, point.lon))
    const routeLine = L.polyline(latLngs, { color: '#b11f24', weight: 4, opacity: 0.9 }).addTo(map)
    map.fitBounds(routeLine.getBounds(), { padding: [24, 24] })
    routeLine.on('click', (event) => {
      let closest = route.points[0]
      let best = Infinity
      for (const point of route.points) {
        const d = map.distance(event.latlng, L.latLng(point.lat, point.lon))
        if (d < best) { best = d; closest = point }
      }
      onPick(closest.distanceKm)
    })
    for (const cue of cues) {
      const distance = cue.kind === 'section' ? cue.startKm : cue.distanceKm
      const point = route.points.reduce((a, b) => Math.abs(b.distanceKm - distance) < Math.abs(a.distanceKm - distance) ? b : a)
      L.circleMarker([point.lat, point.lon], {
        radius: 6,
        weight: 2,
        color: '#f8f4eb',
        fillColor: '#b11f24',
        fillOpacity: 1,
      }).bindTooltip(cue.title || cue.category).addTo(map)
    }
    return () => { map.remove() }
  }, [route, cues, onPick])

  return <div ref={host} className="route-map" aria-label="Route map. Select the route to set a cue distance." />
}
