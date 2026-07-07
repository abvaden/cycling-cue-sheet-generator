import { useEffect, useRef } from 'react'
import L from 'leaflet'
import type { Cue, Route, RoutePoint } from '../types'
import { profilePointsInRange } from '../lib/profile'
import 'leaflet/dist/leaflet.css'

interface Props {
  route: Route
  cues: Cue[]
  onPick: (distanceKm: number) => void
  onHover?: (distanceKm: number | undefined) => void
  onClearSelections?: () => void
  hoverDistanceKm?: number
  selectedDistancesKm?: number[]
  rangeStartKm?: number
  rangeEndKm?: number
}

const closestRoutePoint = (route: Route, distanceKm: number): RoutePoint =>
  route.points.reduce((a, b) =>
    Math.abs(b.distanceKm - distanceKm) < Math.abs(a.distanceKm - distanceKm) ? b : a,
  )

const closestRoutePointToLatLng = (map: L.Map, points: RoutePoint[], latLng: L.LatLng): RoutePoint => {
  let closest = points[0]
  let best = Infinity
  for (const point of points) {
    const d = map.distance(latLng, L.latLng(point.lat, point.lon))
    if (d < best) { best = d; closest = point }
  }
  return closest
}

export function RouteMap({
  route,
  cues,
  onPick,
  onHover,
  onClearSelections,
  hoverDistanceKm,
  selectedDistancesKm = [],
  rangeStartKm,
  rangeEndKm,
}: Props) {
  const host = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const hoverMarkerRef = useRef<L.CircleMarker | null>(null)
  const selectionMarkerRefs = useRef<L.CircleMarker[]>([])

  useEffect(() => {
    if (!host.current) return
    const map = L.map(host.current, { zoomControl: true, attributionControl: true })
    mapRef.current = map
    const sectionPoints = rangeStartKm !== undefined && rangeEndKm !== undefined
      ? profilePointsInRange(route.points, rangeStartKm, rangeEndKm)
      : route.points
    const displayPoints = sectionPoints.length >= 2 ? sectionPoints : route.points
    const clearInteractions = () => {
      onClearSelections?.()
      onHover?.(undefined)
    }
    map.on('contextmenu', clearInteractions)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)
    const latLngs = displayPoints.map((point) => L.latLng(point.lat, point.lon))
    const routeLine = L.polyline(latLngs, {
      color: 'oklch(48% 0.19 25)',
      interactive: false,
      opacity: 0.9,
      weight: 4,
    }).addTo(map)
    const routeHitLine = L.polyline(latLngs, {
      color: 'oklch(48% 0.19 25)',
      opacity: 0.01,
      weight: 24,
    }).addTo(map)
    map.fitBounds(routeLine.getBounds(), { padding: [24, 24] })
    routeHitLine.on('click', (event) => {
      const closest = closestRoutePointToLatLng(map, displayPoints, event.latlng)
      onPick(closest.distanceKm)
    })
    routeHitLine.on('mousemove', (event) => {
      const closest = closestRoutePointToLatLng(map, displayPoints, event.latlng)
      onHover?.(closest.distanceKm)
    })
    routeHitLine.on('mouseout', () => onHover?.(undefined))
    routeHitLine.on('contextmenu', clearInteractions)
    for (const cue of cues) {
      const distance = cue.kind === 'section' ? cue.startKm : cue.distanceKm
      const point = route.points.reduce((a, b) => Math.abs(b.distanceKm - distance) < Math.abs(a.distanceKm - distance) ? b : a)
      L.circleMarker([point.lat, point.lon], {
        radius: 6,
        weight: 2,
        color: 'oklch(97.5% 0.016 83)',
        fillColor: 'oklch(48% 0.19 25)',
        fillOpacity: 1,
      }).bindTooltip(cue.title || cue.category).addTo(map)
    }
    return () => {
      selectionMarkerRefs.current = []
      hoverMarkerRef.current = null
      mapRef.current = null
      map.remove()
    }
  }, [route, cues, onPick, onHover, onClearSelections, rangeStartKm, rangeEndKm])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (hoverDistanceKm === undefined) {
      hoverMarkerRef.current?.remove()
      hoverMarkerRef.current = null
      return
    }

    const point = closestRoutePoint(route, hoverDistanceKm)
    const latLng = L.latLng(point.lat, point.lon)
    if (!hoverMarkerRef.current) {
      hoverMarkerRef.current = L.circleMarker(latLng, {
        radius: 7,
        weight: 2,
        color: 'oklch(24% 0.018 38)',
        fillColor: 'oklch(97.5% 0.016 83)',
        fillOpacity: 1,
        interactive: false,
      }).addTo(map)
      hoverMarkerRef.current.bringToFront()
      return
    }

    hoverMarkerRef.current.setLatLng(latLng)
    hoverMarkerRef.current.bringToFront()
  }, [route, hoverDistanceKm])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    for (const marker of selectionMarkerRefs.current) marker.remove()
    selectionMarkerRefs.current = selectedDistancesKm.map((distanceKm) => {
      const point = closestRoutePoint(route, distanceKm)
      return L.circleMarker([point.lat, point.lon], {
        radius: 7,
        weight: 2,
        color: 'oklch(97.5% 0.016 83)',
        fillColor: 'oklch(24% 0.018 38)',
        fillOpacity: 1,
        interactive: false,
      }).addTo(map)
    })
    for (const marker of selectionMarkerRefs.current) marker.bringToFront()
    hoverMarkerRef.current?.bringToFront()
  }, [route, selectedDistancesKm])

  return <div ref={host} className="route-map" aria-label="Route map. Select the route to set a cue distance." />
}
