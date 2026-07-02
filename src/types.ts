export type Units = 'metric' | 'imperial'
export type DimensionUnit = 'mm' | 'in'

export interface RoutePoint {
  lat: number
  lon: number
  elevation?: number
  distanceKm: number
}

export interface Route {
  name: string
  points: RoutePoint[]
  distanceKm: number
  elevationGainM: number
  hasElevation: boolean
}

export type Visibility = {
  title: boolean
  distance: boolean
  units: boolean
  note: boolean
  profile: boolean
  type: boolean
  time: boolean
}

export type ScalableField = Exclude<keyof Visibility, 'profile' | 'units'>

export interface GridPosition {
  x: number
  y: number
  w: number
  h: number
}

interface CueBase {
  id: string
  order: number
  /** Legacy overall scale retained for persisted project compatibility. */
  fontScale?: number
  fieldScales: Partial<Record<ScalableField, number>>
  title: string
  note: string
  noteBold: boolean
  category: string
  visibility: Visibility
  grid: GridPosition
}

export interface SectionCue extends CueBase {
  kind: 'section'
  startKm: number
  endKm: number
  colorByGrade: boolean
  gradeMaxPercent: number
  gradeResolution: number
  overlayTextOnProfile: boolean
}

export interface PointCue extends CueBase {
  kind: 'point'
  distanceKm: number
  elapsed: string
  horizontalLayout: boolean
}

export type Cue = SectionCue | PointCue

export interface SheetSettings {
  width: number
  height: number
  dimensionUnit: DimensionUnit
  units: Units
  marginMm: number
}

export interface Project {
  id: string
  version: 1
  name: string
  route?: Route
  cues: Cue[]
  orderCustomized?: boolean
  sheet: SheetSettings
  createdAt: string
  updatedAt: string
}

export const defaultVisibility: Visibility = {
  title: true,
  distance: true,
  units: true,
  note: true,
  profile: true,
  type: true,
  time: true,
}

export function cueDistance(cue: Cue) {
  return cue.kind === 'section' ? cue.startKm : cue.distanceKm
}

export function toMm(value: number, unit: DimensionUnit) {
  return unit === 'in' ? value * 25.4 : value
}

export function formatDistance(km: number, units: Units, showUnits = true) {
  const value = units === 'imperial' ? (km * 0.621371).toFixed(1) : km.toFixed(1)
  if (!showUnits) return value
  return units === 'imperial' ? `${value} mi` : `${value} km`
}

export function formatElevation(m: number, units: Units) {
  return units === 'imperial' ? `${Math.round(m * 3.28084).toLocaleString()} ft` : `${Math.round(m).toLocaleString()} m`
}
