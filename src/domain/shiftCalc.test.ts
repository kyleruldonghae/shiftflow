import { describe, expect, it } from 'vitest'
import type { ShiftEntry, ShiftType } from './types'
import { DEFAULT_SHIFT_TYPES } from '@/data/defaults'
import { grossMinutes, netMinutes, resolve, summarize, windowFor } from './shiftCalc'
import { blocksOfKind, countKind } from './holidays'

const types = new Map(DEFAULT_SHIFT_TYPES.map((t) => [t.id, t]))
const T = (id: string) => types.get(id)!
const night: ShiftType = { ...T('late'), id: 'night', code: '223', startMin: 1350, endMin: 360 }
const e = (date: string, shiftTypeId: string, extra: Partial<ShiftEntry> = {}): ShiftEntry => ({
  date, shiftTypeId, source: 'manual', updatedAt: 0, ...extra,
})

describe('shift durations', () => {
  it('calculates the confirmed shift lengths', () => {
    expect(grossMinutes(resolve(e('2026-12-08', 'early'), T('early')))).toBe(540)
    expect(grossMinutes(resolve(e('2026-12-08', 'late'), T('late')))).toBe(540)
  })

  it('handles shifts crossing midnight', () => {
    expect(grossMinutes(resolve(e('2026-12-08', 'night'), night))).toBe(450)
    const w = windowFor('2026-12-08', 1350, 360)!
    expect(new Date(w.end).toISOString()).toBe('2026-12-09T05:00:00.000Z')
  })

  it('is correct on DST nights', () => {
    // spring forward 2026-03-29 02:00 → 03:00: night is one hour shorter
    expect(grossMinutes(resolve(e('2026-03-28', 'night'), night))).toBe(390)
    // fall back 2026-10-25 03:00 → 02:00: night is one hour longer
    expect(grossMinutes(resolve(e('2026-10-24', 'night'), night))).toBe(510)
  })

  it('never guesses net time when the break is not configured', () => {
    expect(netMinutes(resolve(e('2026-12-08', 'early'), T('early')))).toBeUndefined()
  })

  it('subtracts unpaid breaks and keeps paid ones', () => {
    const unpaid = resolve(e('2026-12-08', 'early', { breakMin: 30 }), T('early'))
    expect(netMinutes(unpaid)).toBe(510)
    const paid = resolve(e('2026-12-08', 'early', { breakMin: 30, breakPaid: true }), T('early'))
    expect(netMinutes(paid)).toBe(540)
  })

  it('applies per-day time overrides', () => {
    expect(grossMinutes(resolve(e('2026-12-08', 'early', { endMin: 1020 }), T('early')))).toBe(630)
  })

  it('has no duration for days off', () => {
    expect(grossMinutes(resolve(e('2026-12-08', 'off'), T('off')))).toBeUndefined()
  })
})

describe('summaries', () => {
  const list = [
    e('2026-12-04', 'late'), e('2026-12-05', 'late'), e('2026-12-06', 'late'), // Fri–Sun
    e('2026-12-07', 'off'), e('2026-12-08', 'early'), e('2026-12-09', 'off'),
    e('2026-12-22', 'vacation'), e('2026-12-23', 'vacation'), e('2026-12-24', 'vacation'),
    e('2026-12-28', 'vacation'),
  ]
  const s = summarize(list, types)

  it('counts days by kind', () => {
    expect(s.workDays).toBe(4)
    expect(s.offDays).toBe(2)
    expect(s.vacationDays).toBe(4)
    expect(s.grossMin).toBe(4 * 540)
  })

  it('finds weekend work, streaks and bands', () => {
    expect(s.weekendWorkDays).toBe(2)
    expect(s.longestStreak).toBe(3)
    expect(s.early).toBe(1)
    expect(s.late).toBe(3)
  })

  it('reports net as unknown while breaks are unset', () => {
    expect(s.netMin).toBeUndefined()
  })

  it('groups vacation periods', () => {
    const blocks = blocksOfKind(list, types, 'vacation')
    expect(blocks).toEqual([
      { typeId: 'vacation', from: '2026-12-22', to: '2026-12-24', days: 3 },
      { typeId: 'vacation', from: '2026-12-28', to: '2026-12-28', days: 1 },
    ])
    expect(countKind(list, types, 'vacation', '2026-12-23')).toBe(3)
  })
})
