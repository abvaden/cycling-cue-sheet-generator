import { useEffect, useState } from 'react'
import type { CSSProperties, MouseEvent, PointerEvent, WheelEvent } from 'react'
import type { Cue, Route, Units } from '../types'
import { cueDistance, formatDistance, formatElevation } from '../types'

interface Props {
  route: Route
  cues: Cue[]
  units: Units
  onPick: (distanceKm: number) => void
  onRangePick?: (startKm: number, endKm: number) => void
  onHover?: (distanceKm: number | undefined) => void
  onClearSelections?: () => void
  hoverDistanceKm?: number
  selectedDistancesKm?: number[]
  rangeStartKm?: number
  rangeEndKm?: number
  dragBehavior?: 'zoom' | 'segment'
  showFill?: boolean
}

interface ZoomRange {
  startKm: number
  endKm: number
}

interface DragRange {
  startKm: number
  endKm: number
}

interface SelectedPointStyle {
  index: number
  style: CSSProperties
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

const isSelectedPointStyle = (item: SelectedPointStyle | undefined): item is SelectedPointStyle =>
  item !== undefined

export function ElevationProfile({
  route,
  cues,
  units,
  onPick,
  onRangePick,
  onHover,
  onClearSelections,
  hoverDistanceKm,
  selectedDistancesKm = [],
  rangeStartKm,
  rangeEndKm,
  dragBehavior = 'zoom',
  showFill = true,
}: Props) {
  const totalDistance = Math.max(route.distanceKm, 0.001)
  const requestedStart = rangeStartKm ?? 0
  const requestedEnd = rangeEndKm ?? totalDistance
  const profileStart = clamp(Math.min(requestedStart, requestedEnd), 0, Math.max(0, totalDistance - 0.001))
  const profileEnd = clamp(Math.max(requestedStart, requestedEnd), profileStart + 0.001, totalDistance)
  const profileSpan = Math.max(0.001, profileEnd - profileStart)
  const [zoomRange, setZoomRange] = useState<ZoomRange>({
    startKm: profileStart,
    endKm: profileEnd,
  })
  const [dragRange, setDragRange] = useState<DragRange>()

  useEffect(() => {
    setZoomRange({ startKm: profileStart, endKm: profileEnd })
    setDragRange(undefined)
  }, [route, profileStart, profileEnd])

  if (!route.hasElevation) {
    return <div className="profile-missing"><span>Elevation unavailable</span><p>This GPX can still be annotated and exported.</p></div>
  }
  const zoomStart = clamp(zoomRange.startKm, profileStart, Math.max(profileStart, profileEnd - 0.001))
  const zoomEnd = clamp(Math.max(zoomRange.endKm, zoomStart + 0.001), zoomStart + 0.001, profileEnd)
  const zoomSpan = Math.max(0.001, zoomEnd - zoomStart)
  const minZoomSpan = Math.min(profileSpan, Math.max(profileSpan * 0.02, 0.2))
  const minSegmentSpan = Math.min(profileSpan, Math.max(profileSpan * 0.005, 0.01))
  const elevationPoints = route.points.filter(
    (point) => point.distanceKm >= profileStart && point.distanceKm <= profileEnd,
  )
  const elevations = (elevationPoints.length ? elevationPoints : route.points).map((point) => point.elevation ?? 0)
  const min = Math.min(...elevations)
  const max = Math.max(...elevations)
  const span = Math.max(1, max - min)
  const xFromDistance = (distanceKm: number) => ((distanceKm - zoomStart) / zoomSpan) * 100
  const yFromElevation = (elevation?: number) => 100 - (((elevation ?? min) - min) / span) * 100
  const visiblePoints = route.points
    .filter((point) => point.distanceKm >= zoomStart && point.distanceKm <= zoomEnd)
  const plottedPoints = visiblePoints.length
    ? visiblePoints
    : [route.points.reduce((a, b) =>
        Math.abs(b.distanceKm - (zoomStart + zoomSpan / 2)) < Math.abs(a.distanceKm - (zoomStart + zoomSpan / 2)) ? b : a,
      )]
  const points = plottedPoints.map((point) => `${xFromDistance(point.distanceKm)},${yFromElevation(point.elevation)}`).join(' ')
  const hoverPoint = hoverDistanceKm === undefined
    ? undefined
    : route.points.reduce((a, b) =>
        Math.abs(b.distanceKm - hoverDistanceKm) < Math.abs(a.distanceKm - hoverDistanceKm) ? b : a,
      )
  const hoverPointVisible = hoverPoint && hoverPoint.distanceKm >= zoomStart && hoverPoint.distanceKm <= zoomEnd
  const hoverPointStyle = hoverPointVisible ? {
    left: `${xFromDistance(hoverPoint.distanceKm)}%`,
    top: `${yFromElevation(hoverPoint.elevation) * 0.8}px`,
  } satisfies CSSProperties : undefined
  const selectedPointStyles = selectedDistancesKm
    .map<SelectedPointStyle | undefined>((distanceKm, index) => {
      const point = route.points.reduce((a, b) =>
        Math.abs(b.distanceKm - distanceKm) < Math.abs(a.distanceKm - distanceKm) ? b : a,
      )
      if (point.distanceKm < zoomStart || point.distanceKm > zoomEnd) return undefined
      return {
        index,
        style: {
          left: `${xFromDistance(point.distanceKm)}%`,
          top: `${yFromElevation(point.elevation) * 0.8}px`,
        } satisfies CSSProperties,
      }
    })
    .filter(isSelectedPointStyle)
  const selectionStyle = dragRange ? {
    left: `${clamp(xFromDistance(Math.min(dragRange.startKm, dragRange.endKm)), 0, 100)}%`,
    width: `${Math.abs(
      clamp(xFromDistance(dragRange.endKm), 0, 100) -
      clamp(xFromDistance(dragRange.startKm), 0, 100),
    )}%`,
  } satisfies CSSProperties : undefined
  const distanceFromPointer = (event: PointerEvent<SVGSVGElement> | MouseEvent<SVGSVGElement> | WheelEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return clamp(zoomStart + ((event.clientX - rect.left) / rect.width) * zoomSpan, profileStart, profileEnd)
  }
  const zoomToRange = (startKm: number, endKm: number) => {
    const nextStart = clamp(Math.min(startKm, endKm), profileStart, profileEnd)
    const nextEnd = clamp(Math.max(startKm, endKm), profileStart, profileEnd)
    if (nextEnd - nextStart >= minZoomSpan) setZoomRange({ startKm: nextStart, endKm: nextEnd })
  }
  const resetZoom = () => {
    setZoomRange({ startKm: profileStart, endKm: profileEnd })
    setDragRange(undefined)
  }
  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    const anchor = distanceFromPointer(event)
    const ratio = (anchor - zoomStart) / zoomSpan
    const scale = event.deltaY < 0 ? 0.78 : 1.28
    const nextSpan = clamp(zoomSpan * scale, minZoomSpan, profileSpan)
    const nextStart = clamp(anchor - ratio * nextSpan, profileStart, profileEnd - nextSpan)
    setZoomRange({ startKm: nextStart, endKm: nextStart + nextSpan })
  }
  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    const distanceKm = distanceFromPointer(event)
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragRange({ startKm: distanceKm, endKm: distanceKm })
    onHover?.(distanceKm)
  }
  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const distanceKm = distanceFromPointer(event)
    onHover?.(distanceKm)
    if (dragRange) setDragRange({ ...dragRange, endKm: distanceKm })
  }
  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const distanceKm = distanceFromPointer(event)
    if (!dragRange) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    const dragSpan = Math.abs(distanceKm - dragRange.startKm)
    if (dragBehavior === 'segment' && dragSpan >= minSegmentSpan) onRangePick?.(dragRange.startKm, distanceKm)
    else if (dragBehavior === 'zoom' && dragSpan >= minZoomSpan) zoomToRange(dragRange.startKm, distanceKm)
    else onPick(distanceKm)
    setDragRange(undefined)
  }
  const handleContextMenu = (event: MouseEvent<SVGSVGElement>) => {
    event.preventDefault()
    resetZoom()
    onClearSelections?.()
    onHover?.(undefined)
  }

  return (
    <div className="profile-wrap">
      <svg
        className="elevation-profile"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        role="img"
        aria-label="Elevation profile"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => setDragRange(undefined)}
        onPointerLeave={() => {
          if (!dragRange) onHover?.(undefined)
        }}
        onDoubleClick={resetZoom}
        onContextMenu={handleContextMenu}
      >
        {showFill && <polygon points={`0,100 ${points} 100,100`} className="profile-fill" />}
        <polyline points={points} className="profile-line" />
        {cues.map((cue) => {
          const distance = cueDistance(cue)
          if (distance < zoomStart || distance > zoomEnd) return null
          const x = xFromDistance(distance)
          return <line key={cue.id} x1={x} x2={x} y1="0" y2="100" className="profile-marker" />
        })}
      </svg>
      {selectionStyle && <span className="profile-zoom-selection" style={selectionStyle} aria-hidden="true" />}
      {selectedPointStyles.map(({ index, style }) => (
        <span className="profile-selected-dot" style={style} aria-hidden="true" key={`${index}-${style.left}`} />
      ))}
      {hoverPointStyle && <span className="profile-hover-dot" style={hoverPointStyle} aria-hidden="true" />}
      <div className="profile-axis"><span>{formatElevation(min, units)}</span><span>{formatDistance(zoomStart, units)} - {formatDistance(zoomEnd, units)}</span><span>{formatElevation(max, units)}</span></div>
    </div>
  )
}
