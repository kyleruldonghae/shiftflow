import type { ShiftEntry, ShiftType } from '@/domain/types'
import { resolve, windowFor, type Resolved } from '@/domain/shiftCalc'
import type { ZonedNow } from '@/domain/time'

export type TodayState =
  | { kind: 'upcoming' | 'active' | 'done'; entry: ShiftEntry; r: Resolved; start: number; end: number; fromYesterday?: boolean }
  | { kind: 'notimes'; entry: ShiftEntry; r: Resolved }
  | { kind: 'off'; entry: ShiftEntry; type: ShiftType }
  | { kind: 'none' }

/** What the "today" card shows right now, including a night shift that started yesterday. */
export function todayState(
  now: ZonedNow, today?: ShiftEntry, yesterday?: ShiftEntry, types?: Map<string, ShiftType>,
): TodayState {
  if (!types) return { kind: 'none' }
  if (yesterday) {
    const t = types.get(yesterday.shiftTypeId)
    if (t?.kind === 'work') {
      const r = resolve(yesterday, t)
      const w = windowFor(r.date, r.startMin, r.endMin)
      if (w && now.ms >= w.start && now.ms < w.end) return { kind: 'active', entry: yesterday, r, ...w, fromYesterday: true }
    }
  }
  if (!today) return { kind: 'none' }
  const t = types.get(today.shiftTypeId)
  if (!t) return { kind: 'none' }
  if (t.kind !== 'work') return { kind: 'off', entry: today, type: t }
  const r = resolve(today, t)
  const w = windowFor(r.date, r.startMin, r.endMin)
  if (!w) return { kind: 'notimes', entry: today, r }
  if (now.ms < w.start) return { kind: 'upcoming', entry: today, r, ...w }
  if (now.ms < w.end) return { kind: 'active', entry: today, r, ...w }
  return { kind: 'done', entry: today, r, ...w }
}
