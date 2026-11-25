import type { DateKey } from '@/domain/types'
import { addDays } from '@/domain/time'
import { db } from './db'
import { commit, type EntryUpdate } from './repo'

const PATTERN = ['early', 'early', 'late', 'late', 'off', 'off', 'day', 'mid', 'late', 'early', 'off', 'wish', 'early', 'late']

/** Fills only empty days around today with clearly marked demo shifts. */
export async function loadDemo(today: DateKey, label: string) {
  const types = new Set((await db.shiftTypes.toArray()).filter((t) => !t.archived).map((t) => t.id))
  const updates: EntryUpdate[] = []
  for (let i = -14; i <= 30; i++) {
    const date = addDays(today, i)
    const typeId = PATTERN[(i + 14) % PATTERN.length]
    if (!types.has(typeId) || (await db.entries.get(date))) continue
    updates.push({ date, entry: { shiftTypeId: typeId, source: 'demo' } })
  }
  return updates.length ? commit(label, 'demo', updates) : null
}

export async function removeDemo(label: string) {
  const demo = await db.entries.where('source').equals('demo').toArray()
  return demo.length ? commit(label, 'demo', demo.map((e) => ({ date: e.date, entry: null }))) : null
}
