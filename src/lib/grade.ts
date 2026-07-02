export type GradeBand = 'descent' | 'easy' | 'moderate' | 'hard' | 'steep'

export function gradePercent(elevationDeltaM: number, distanceDeltaKm: number) {
  if (distanceDeltaKm <= 0) return 0
  return (elevationDeltaM / (distanceDeltaKm * 1000)) * 100
}

export function gradeBand(grade: number, redStartsAt = 9): GradeBand {
  const maximum = Math.max(0.3, redStartsAt)
  if (grade < 0) return 'descent'
  if (grade < maximum / 3) return 'easy'
  if (grade < (maximum * 2) / 3) return 'moderate'
  if (grade < maximum) return 'hard'
  return 'steep'
}

export const gradeColors: Record<GradeBand, { hex: string; rgb: [number, number, number] }> = {
  descent: { hex: '#2878a5', rgb: [40, 120, 165] },
  easy: { hex: '#37834f', rgb: [55, 131, 79] },
  moderate: { hex: '#c39922', rgb: [195, 153, 34] },
  hard: { hex: '#d46725', rgb: [212, 103, 37] },
  steep: { hex: '#b11f24', rgb: [177, 31, 36] },
}

export function colorForGrade(grade: number, redStartsAt = 9) {
  return gradeColors[gradeBand(grade, redStartsAt)]
}

export type ClimbCategory = 'uncategorized' | 'cat4' | 'cat3' | 'cat2' | 'cat1' | 'hc'

/**
 * Cycling climb difficulty score: climb length (m) × average grade (%).
 * Only rising terrain scores; descents and flats return 0.
 */
export function climbScore(elevationDeltaM: number, distanceDeltaKm: number) {
  const grade = gradePercent(elevationDeltaM, distanceDeltaKm)
  if (grade <= 0) return 0
  return distanceDeltaKm * 1000 * grade
}

/** Categorize a climb from its score using the common Strava-style thresholds. */
export function climbCategory(elevationDeltaM: number, distanceDeltaKm: number): ClimbCategory {
  const score = climbScore(elevationDeltaM, distanceDeltaKm)
  if (score >= 80000) return 'hc'
  if (score >= 64000) return 'cat1'
  if (score >= 32000) return 'cat2'
  if (score >= 16000) return 'cat3'
  if (score >= 8000) return 'cat4'
  return 'uncategorized'
}

export const climbColors: Record<ClimbCategory, { hex: string; rgb: [number, number, number] }> = {
  uncategorized: { hex: '#6b7280', rgb: [107, 114, 128] },
  cat4: { hex: '#37834f', rgb: [55, 131, 79] },
  cat3: { hex: '#c39922', rgb: [195, 153, 34] },
  cat2: { hex: '#d46725', rgb: [212, 103, 37] },
  cat1: { hex: '#b11f24', rgb: [177, 31, 36] },
  hc: { hex: '#6f0f14', rgb: [111, 15, 20] },
}

export function colorForClimb(elevationDeltaM: number, distanceDeltaKm: number) {
  return climbColors[climbCategory(elevationDeltaM, distanceDeltaKm)]
}
