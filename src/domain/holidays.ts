import type { DateKey, ShiftEntry, ShiftKind, ShiftType } from './types'
import { diffDays } from './time'

export interface Block {
  typeId: string
  from: DateKey
  to: DateKey
  days: number
}

/** Groups consecutive days of the same kind and type into periods (e.g. one vacation). */
export function blocksOfKind(entries: ShiftEntry[], types: Map<string, ShiftType>, kind: ShiftKind): Block[] {
  const list = entries
    .filter((e) => types.get(e.shiftTypeId)?.kind === kind)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
  const blocks: Block[] = []
  for (const e of list) {
    const last = blocks[blocks.length - 1]
    if (last && last.typeId === e.shiftTypeId && diffDays(last.to, e.date) === 1) {
      last.to = e.date
      last.days++
    } else {
      blocks.push({ typeId: e.shiftTypeId, from: e.date, to: e.date, days: 1 })
    }
  }
  return blocks
}

export function countKind(entries: ShiftEntry[], types: Map<string, ShiftType>, kind: ShiftKind, from?: DateKey, to?: DateKey) {
  return entries.filter(
    (e) => types.get(e.shiftTypeId)?.kind === kind && (!from || e.date >= from) && (!to || e.date <= to),
  ).length
}
