import { describe, expect, it } from 'vitest'
import {
  addDays, addMonths, daysInMonth, diffDays, fmtDuration, fmtHM, instantAt, monthGrid, parseHM,
  startOfWeek, weekdayIndex, zonedNow,
} from './time'

describe('calendar arithmetic', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
  })

  it('handles leap years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
    expect(daysInMonth(2028, 2)).toBe(29)
    expect(daysInMonth(2100, 2)).toBe(28)
    expect(daysInMonth(2000, 2)).toBe(29)
  })

  it('is not affected by DST changes', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(diffDays('2026-03-01', '2026-04-01')).toBe(31)
    expect(diffDays('2026-10-01', '2026-11-01')).toBe(31)
  })

  it('uses Monday as first day of the week', () => {
    expect(weekdayIndex('2026-11-30')).toBe(0) // Monday
    expect(weekdayIndex('2026-11-29')).toBe(6) // Sunday
    expect(startOfWeek('2026-11-25')).toBe('2026-11-23')
    const grid = monthGrid(2026, 11)
    expect(grid).toHaveLength(42)
    expect(grid[0]).toBe('2026-10-26')
    expect(grid[6]).toBe('2026-11-01')
  })

  it('moves months', () => {
    expect(addMonths(2026, 12, 1)).toEqual({ y: 2027, m: 1 })
    expect(addMonths(2026, 1, -1)).toEqual({ y: 2025, m: 12 })
  })
})

describe('time of day', () => {
  it('parses and formats HH:mm', () => {
    expect(parseHM('06:30')).toBe(390)
    expect(parseHM('6:30')).toBe(390)
    expect(parseHM('24:00')).toBeUndefined()
    expect(fmtHM(390)).toBe('06:30')
    expect(fmtHM(1440 + 360)).toBe('06:00')
  })

  it('formats durations', () => {
    expect(fmtDuration(540)).toBe('9h')
    expect(fmtDuration(510)).toBe('8h 30m')
    expect(fmtDuration(-45)).toBe('−0h 45m')
    expect(fmtDuration(510, 'de')).toBe('8 Std. 30 Min.')
  })

  it('maps Zurich wall time to real instants', () => {
    // 2026-07-01 06:30 in Zurich (CEST, UTC+2) = 04:30 UTC
    expect(new Date(instantAt('2026-07-01', 390)).toISOString()).toBe('2026-07-01T04:30:00.000Z')
    // 2026-12-01 06:30 in Zurich (CET, UTC+1) = 05:30 UTC
    expect(new Date(instantAt('2026-12-01', 390)).toISOString()).toBe('2026-12-01T05:30:00.000Z')
    // minutes past 24h roll into the next day
    expect(new Date(instantAt('2026-12-01', 1440 + 360)).toISOString()).toBe('2026-12-02T05:00:00.000Z')
  })

  it('reads "now" in Zurich regardless of device zone', () => {
    const z = zonedNow(Date.parse('2026-12-31T23:30:00Z')) // already 00:30 on Jan 1 in Zurich
    expect(z.key).toBe('2027-01-01')
    expect(z.minutes).toBe(30)
  })
})
