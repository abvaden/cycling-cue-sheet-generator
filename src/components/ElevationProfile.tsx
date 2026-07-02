import type { Cue, Route, Units } from '../types'
import { cueDistance, formatDistance, formatElevation } from '../types'

interface Props { route: Route; cues: Cue[]; units: Units; onPick: (distanceKm: number) => void }

export function ElevationProfile({ route, cues, units, onPick }: Props) {
  if (!route.hasElevation) {
    return <div className="profile-missing"><span>Elevation unavailable</span><p>This GPX can still be annotated and exported.</p></div>
  }
  const elevations = route.points.map((point) => point.elevation ?? 0)
  const min = Math.min(...elevations)
  const max = Math.max(...elevations)
  const span = Math.max(1, max - min)
  const points = route.points.map((point) => `${(point.distanceKm / route.distanceKm) * 100},${100 - (((point.elevation ?? min) - min) / span) * 100}`).join(' ')

  return (
    <div className="profile-wrap">
      <svg className="elevation-profile" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Elevation profile" onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        onPick(Math.max(0, Math.min(route.distanceKm, ((event.clientX - rect.left) / rect.width) * route.distanceKm)))
      }}>
        <polygon points={`0,100 ${points} 100,100`} className="profile-fill" />
        <polyline points={points} className="profile-line" />
        {cues.map((cue) => <line key={cue.id} x1={(cueDistance(cue) / route.distanceKm) * 100} x2={(cueDistance(cue) / route.distanceKm) * 100} y1="0" y2="100" className="profile-marker" />)}
      </svg>
      <div className="profile-axis"><span>{formatElevation(min, units)}</span><span>{formatDistance(route.distanceKm, units)}</span><span>{formatElevation(max, units)}</span></div>
    </div>
  )
}
