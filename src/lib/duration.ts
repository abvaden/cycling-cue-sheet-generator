export function normalizeElapsedDuration(value: string) {
  const trimmed = value.trim()
  const match = /^(\d+):([0-5]\d)(?::([0-5]\d))?$/.exec(trimmed)
  if (!match) return trimmed
  const hours = match[1].padStart(2, '0')
  return `${hours}:${match[2]}:${match[3] ?? '00'}`
}

export function isElapsedDuration(value: string) {
  return value === '' || /^\d+:[0-5]\d:[0-5]\d$/.test(value)
}
