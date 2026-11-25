import type { DateKey, ShiftEntry, ShiftType } from './types'
import { diffDays, instantAt, isWeekend } from './time'

/** An entry combined with its shift type's defaults. */
export interface Resolved {
  date: DateKey
  type: ShiftType
  isWork: boolean
  startMin?: number
  endMin?: number
  breakMin?: number
  breakPaid: boolean
}

export function resolve(entry: ShiftEntry, type: ShiftType): Resolved {
  const isWork = type.kind === 'work'
  return {
    date: entry.date,
    type,
    isWork,
    startMin: isWork ? (entry.startMin ?? type.startMin) : undefined,
    endMin: isWork ? (entry.endMin ?? type.endMin) : undefined,
    breakMin: isWork ? (entry.breakMin ?? type.breakMin) : undefined,
    breakPaid: entry.breakPaid ?? type.breakPaid,
  }
}

export const crossesMidnight = (startMin: number, endMin: number) => endMin <= startMin

/** Real start/end instants. Uses Zurich wall time, so DST nights are 1 h shorter/longer. */
export function windowFor(date: DateKey, startMin?: number, endMin?: number) {
  if (startMin == null || endMin == null) return null
  const end = crossesMidnight(startMin, endMin) ? endMin + 1440 : endMin
  return { start: instantAt(date, startMin), end: instantAt(date, end) }
}

/** Total shift duration including breaks. */
export function grossMinutes(r: Resolved): number | undefined {
  if (!r.isWork) return undefined
  const w = windowFor(r.date, r.startMin, r.endMin)
  return w ? Math.round((w.end - w.start) / 60_000) : undefined
}

/** Paid working time. Undefined while the break is not configured – never guessed. */
export function netFromGross(gross: number | undefined, breakMin: number | undefined, paid: boolean) {
  if (gross == null || breakMin == null) return undefined
  return paid ? gross : Math.max(0, gross - breakMin)
}

export function netMinutes(r: Resolved) {
  return netFromGross(grossMinutes(r), r.breakMin, r.breakPaid)
}

export function actualGrossMinutes(entry: ShiftEntry, r: Resolved): number | undefined {
  if (!r.isWork) return undefined
  const w = windowFor(entry.date, entry.actualStartMin, entry.actualEndMin)
  return w ? Math.round((w.end - w.start) / 60_000) : undefined
}

/** early < 10:00 ≤ middle < 13:00 ≤ late */
export function shiftBand(startMin: number): 'early' | 'mid' | 'late' {
  if (startMin < 600) return 'early'
  if (startMin < 780) return 'mid'
  return 'late'
}

export interface Summary {
  workDays: number
  offDays: number
  vacationDays: number
  sickDays: number
  publicHolidayDays: number
  grossMin: number
  /** Undefined when any shift in the period has no break configured. */
  netMin?: number
  weekendWorkDays: number
  longestStreak: number
  early: number
  mid: number
  late: number
  byType: Record<string, number>
}

export function summarize(entries: ShiftEntry[], types: Map<string, ShiftType>): Summary {
  const s: Summary = {
    workDays: 0, offDays: 0, vacationDays: 0, sickDays: 0, publicHolidayDays: 0,
    grossMin: 0, netMin: 0, weekendWorkDays: 0, longestStreak: 0,
    early: 0, mid: 0, late: 0, byType: {},
  }
  let netKnown = true
  let streak = 0
  let lastWork: DateKey | undefined
  for (const e of [...entries].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    const t = types.get(e.shiftTypeId)
    if (!t) continue
    s.byType[t.id] = (s.byType[t.id] ?? 0) + 1
    switch (t.kind) {
      case 'work': {
        const r = resolve(e, t)
        s.workDays++
        s.grossMin += grossMinutes(r) ?? 0
        const n = netMinutes(r)
        if (n == null) netKnown = false
        else s.netMin = (s.netMin ?? 0) + n
        if (isWeekend(e.date)) s.weekendWorkDays++
        if (r.startMin != null) s[shiftBand(r.startMin)]++
        streak = lastWork && diffDays(lastWork, e.date) === 1 ? streak + 1 : 1
        lastWork = e.date
        s.longestStreak = Math.max(s.longestStreak, streak)
        break
      }
      case 'off': s.offDays++; break
      case 'vacation': s.vacationDays++; break
      case 'sick': s.sickDays++; break
      case 'publicHoliday': s.publicHolidayDays++; break
    }
  }
  if (!netKnown) s.netMin = undefined
  return s
}
