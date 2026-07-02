import { describe, expect, it } from 'vitest'
import { isElapsedDuration, normalizeElapsedDuration } from './duration'

describe('elapsed duration', () => {
  it('adds seconds to legacy hour/minute values', () => expect(normalizeElapsedDuration('2:35')).toBe('02:35:00'))
  it('supports durations longer than a day', () => expect(normalizeElapsedDuration('27:04:09')).toBe('27:04:09'))
  it('rejects clock-invalid minute and second values', () => {
    expect(isElapsedDuration('02:60:00')).toBe(false)
    expect(isElapsedDuration('02:35:45')).toBe(true)
  })
})
