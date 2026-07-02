import { describe, expect, it } from 'vitest'
import { colorForGrade, gradeBand, gradePercent } from './grade'

describe('grade classification', () => {
  it('calculates grade from elevation and route distance', () => {
    expect(gradePercent(50, 1)).toBe(5)
    expect(gradePercent(-20, 0.5)).toBe(-4)
  })

  it('assigns stable display bands', () => {
    expect([-2, 2, 4, 7, 12].map((grade) => gradeBand(grade))).toEqual(['descent', 'easy', 'moderate', 'hard', 'steep'])
  })

  it('scales all positive bands from the red threshold', () => {
    expect([2, 5, 8, 12].map((grade) => gradeBand(grade, 12))).toEqual(['easy', 'moderate', 'hard', 'steep'])
  })

  it('derives distinct colors from elevation-based grades', () => {
    const grades = [
      gradePercent(-20, 1),
      gradePercent(10, 1),
      gradePercent(40, 1),
      gradePercent(70, 1),
      gradePercent(100, 1),
    ]
    expect(grades.map((grade) => colorForGrade(grade, 9).hex)).toEqual([
      '#2878a5', '#37834f', '#c39922', '#d46725', '#b11f24',
    ])
  })
})
