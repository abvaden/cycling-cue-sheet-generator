import type { Cue, Project, Route, RoutePoint } from '../types'
import { formatDistance, formatElevation, toMm } from '../types'
import { colorForClimb, colorForGrade, gradePercent } from '../lib/grade'
import { resampleProfile } from '../lib/profile'
import { GRID_UNIT_MM, sheetGridSize } from '../lib/layout'

interface Props {
  project: Project
  selectedId?: string
  onSelect: (id: string) => void
}

function MiniProfile({ route, cue, cues }: { route: Route; cue: Extract<Cue, { kind: 'section' }>; cues: Cue[] }) {
  const points = route.points.filter((point) => point.distanceKm >= cue.startKm && point.distanceKm <= cue.endKm && point.elevation !== undefined)
  if (points.length < 2) return null
  const values = points.map((point) => point.elevation ?? 0)
  const min = Math.min(...values); const span = Math.max(1, Math.max(...values) - min)
  const startKm = points[0].distanceKm
  const distanceSpan = Math.max(0.001, points.at(-1)!.distanceKm - startKm)
  const toCoordinate = (point: RoutePoint) => ({ x: ((point.distanceKm - startKm) / distanceSpan) * 100, y: 100 - (((point.elevation ?? min) - min) / span) * 100 })
  const coordinates = points.map(toCoordinate)
  const polyline = coordinates.map(({ x, y }) => `${x},${y}`).join(' ')
  const shadePoints = resampleProfile(points, cue.gradeResolution ?? 24)
  const shadeCoordinates = shadePoints.map(toCoordinate)
  const shadeSegments = shadeCoordinates.slice(1).map((point, index) => {
    const previous = shadeCoordinates[index]
    const grade = gradePercent((shadePoints[index + 1].elevation ?? 0) - (shadePoints[index].elevation ?? 0), shadePoints[index + 1].distanceKm - shadePoints[index].distanceKm)
    return { point, previous, color: colorForGrade(grade, cue.gradeMaxPercent ?? 9).hex }
  })
  const segmentColor = (index: number) => {
    const bandIndex = Math.min(shadeSegments.length - 1, Math.max(0, Math.floor(((points[index].distanceKm - startKm) / distanceSpan) * shadeSegments.length)))
    return shadeSegments[bandIndex]?.color ?? '#b11f24'
  }
  // Merge consecutive same-color segments into one filled shape: vertical left
  // and right edges, the profile points along the top, and a flat baseline. A
  // single shape per color run means no seams between translucent fills.
  const gradeFills: { points: string; top: string; color: string }[] = []
  for (let start = 0; start < coordinates.length - 1; ) {
    const color = segmentColor(start)
    let end = start
    while (end + 1 < coordinates.length - 1 && segmentColor(end + 1) === color) end++
    const top = coordinates.slice(start, end + 2).map(({ x, y }) => `${x},${y}`).join(' ')
    gradeFills.push({ color, top, points: `${coordinates[start].x},100 ${top} ${coordinates[end + 1].x},100` })
    start = end + 1
  }
  // When this profile spans the whole route it doubles as a course overview:
  // mark every point cue with a vertical line and shade every section cue span.
  const isCourseProfile = cue.startKm <= 0.01 && cue.endKm >= route.distanceKm - 0.01
  const xForKm = (km: number) => ((km - startKm) / distanceSpan) * 100
  const sectionShades = isCourseProfile && !cue.colorByGrade
    ? cues.flatMap((item) => {
        if (item.kind !== 'section' || item.id === cue.id) return []
        const within = points.filter((point) => point.distanceKm >= item.startKm && point.distanceKm <= item.endKm)
        if (within.length < 2) return []
        const color = colorForClimb((within.at(-1)!.elevation ?? 0) - (within[0].elevation ?? 0), within.at(-1)!.distanceKm - within[0].distanceKm).hex
        const shape = within.map(toCoordinate).map(({ x, y }) => `${x},${y}`).join(' ')
        return [<polygon className="section-shade" key={`shade-${item.id}`} style={{ fill: color }} points={`${xForKm(within[0].distanceKm)},100 ${shape} ${xForKm(within.at(-1)!.distanceKm)},100`} />]
      })
    : []
  const pointMarkers = isCourseProfile
    ? cues.flatMap((item) => {
        if (item.kind !== 'point') return []
        const x = xForKm(item.distanceKm)
        if (x < 0 || x > 100) return []
        return [<line className="point-marker" key={`point-${item.id}`} x1={x} x2={x} y1="0" y2="100" />]
      })
    : []
  const baseFills = cue.colorByGrade
    ? gradeFills.map(({ points, color }, index) => <polygon className="grade-fill" key={`fill-${index}`} points={points} fill={color} />)
    : isCourseProfile
    ? null
    : <polygon points={`0,100 ${polyline} 100,100`} />
  const baseLines = cue.colorByGrade
    ? gradeFills.map(({ top, color }, index) => <polyline key={`line-${index}`} points={top} style={{ stroke: color }} />)
    : <polyline points={polyline} />
  return <svg className="mini-profile" viewBox="0 0 100 100" preserveAspectRatio="none">{baseFills}{sectionShades}{baseLines}{pointMarkers}</svg>
}

export function SheetCanvas({ project, selectedId, onSelect }: Props) {
  const widthMm = toMm(project.sheet.width, project.sheet.dimensionUnit)
  const heightMm = toMm(project.sheet.height, project.sheet.dimensionUnit)
  const cssPixelsPerMm = 96 / 25.4
  const gridSize = sheetGridSize(project.sheet)
  const overflow = project.cues.some((cue) => cue.grid.x + cue.grid.w > gridSize.columns || cue.grid.y + cue.grid.h > gridSize.rows)

  return (
    <div className="sheet-stage">
      <div className="sheet-ruler"><span>{project.sheet.width}{project.sheet.dimensionUnit} × {project.sheet.height}{project.sheet.dimensionUnit}</span><span>10 mm grid · 100% CSS print scale</span></div>
      <div data-cue-sheet-preview className={`sheet ${overflow ? 'has-overflow' : ''}`} style={{ width: widthMm * cssPixelsPerMm, height: heightMm * cssPixelsPerMm, padding: project.sheet.marginMm * cssPixelsPerMm, gridTemplateColumns: `repeat(${gridSize.columns}, ${GRID_UNIT_MM * cssPixelsPerMm}px)`, gridTemplateRows: `repeat(${gridSize.rows}, ${GRID_UNIT_MM * cssPixelsPerMm}px)` }}>
        {project.cues.length === 0 && <div className="sheet-empty"><strong>Your ride, reduced to essentials.</strong><span>Add a section or point to begin the sheet.</span></div>}
        {project.cues.map((cue) => (
          <article
            key={cue.id}
            className={`cue-card ${selectedId === cue.id ? 'selected' : ''} ${cue.kind === 'point' && cue.horizontalLayout ? 'horizontal-point' : ''}`}
            style={{
              gridColumn: `${cue.grid.x + 1} / span ${cue.grid.w}`,
              gridRow: `${cue.grid.y + 1} / span ${cue.grid.h}`,
              '--scale-type': cue.fieldScales?.type ?? cue.fontScale ?? 1,
              '--scale-title': cue.fieldScales?.title ?? cue.fontScale ?? 1,
              '--scale-distance': cue.fieldScales?.distance ?? cue.fontScale ?? 1,
              '--scale-note': cue.fieldScales?.note ?? cue.fontScale ?? 1,
              '--scale-time': cue.fieldScales?.time ?? cue.fontScale ?? 1,
            } as React.CSSProperties}
            onClick={() => onSelect(cue.id)}
          >
            {cue.visibility.type && <div className="cue-card-bar"><span>{cue.category}</span></div>}
            {cue.visibility.title && cue.title && <h3>{cue.title}</h3>}
            {cue.visibility.distance && !(cue.kind === 'section' && cue.overlayTextOnProfile && cue.visibility.profile && project.route?.hasElevation) && <strong className="cue-distance">{cue.kind === 'section' ? <>{formatDistance(cue.startKm, project.sheet.units, cue.visibility.units !== false)}<span className="distance-separator">–</span>{formatDistance(cue.endKm, project.sheet.units, cue.visibility.units !== false)}</> : formatDistance(cue.distanceKm, project.sheet.units, cue.visibility.units !== false)}</strong>}
            {cue.kind === 'point' && cue.visibility.time && cue.elapsed && <strong className="cue-time">{cue.elapsed}</strong>}
            {cue.kind === 'section' && cue.visibility.profile && project.route?.hasElevation && <div className={`profile-composition ${cue.overlayTextOnProfile ? 'with-overlay' : ''}`}><MiniProfile route={project.route} cue={cue} cues={project.cues} />{cue.overlayTextOnProfile && <div className="profile-overlay-copy">{cue.visibility.distance && <strong className="cue-distance">{formatDistance(cue.startKm, project.sheet.units, cue.visibility.units !== false)}<span className="distance-separator">–</span>{formatDistance(cue.endKm, project.sheet.units, cue.visibility.units !== false)}</strong>}{cue.visibility.note && cue.note && <p className={cue.noteBold ? 'bold-note' : ''}>{cue.note}</p>}</div>}</div>}
            {cue.visibility.note && cue.note && !(cue.kind === 'section' && cue.overlayTextOnProfile && cue.visibility.profile && project.route?.hasElevation) && <p className={cue.noteBold ? 'bold-note' : ''}>{cue.note}</p>}
            {cue.kind === 'section' && project.route?.hasElevation && <span className="sr-only">Elevation available; route gain {formatElevation(project.route.elevationGainM, project.sheet.units)}</span>}
          </article>
        ))}
      </div>
    </div>
  )
}
