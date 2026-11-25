import type { ChangeKind, ChangeSet, DateKey, ShiftEntry } from '@/domain/types'
import { db as defaultDb, type ShiftFlowDB } from './db'

export interface EntryUpdate {
  date: DateKey
  /** null removes the day. */
  entry: Omit<ShiftEntry, 'date' | 'updatedAt'> | null
}

export function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

/**
 * The only way shift entries are written. Records what each day looked like before and after,
 * which powers undo, bulk edits, paste and the import history.
 */
export async function commit(
  label: string,
  kind: ChangeKind,
  updates: EntryUpdate[],
  opts: { id?: string; importMeta?: ChangeSet['importMeta']; db?: ShiftFlowDB } = {},
): Promise<ChangeSet> {
  const db = opts.db ?? defaultDb
  return db.transaction('rw', db.entries, db.changes, async () => {
    const now = Date.now()
    const before: ChangeSet['before'] = []
    const after: ChangeSet['after'] = []
    for (const u of updates) {
      const prev = await db.entries.get(u.date)
      before.push({ date: u.date, entry: prev })
      if (u.entry) {
        const e: ShiftEntry = { ...u.entry, date: u.date, updatedAt: now }
        await db.entries.put(e)
        after.push({ date: u.date, entry: e })
      } else {
        await db.entries.delete(u.date)
        after.push({ date: u.date })
      }
    }
    const cs: ChangeSet = { id: opts.id ?? uid(), createdAt: now, label, kind, before, after, importMeta: opts.importMeta }
    await db.changes.add(cs)
    return cs
  })
}

function sameEntry(a?: ShiftEntry, b?: ShiftEntry) {
  if (!a && !b) return true
  if (!a || !b) return false
  return a.updatedAt === b.updatedAt && a.shiftTypeId === b.shiftTypeId
}

export type UndoResult = { ok: true } | { ok: false; conflicts: number }

/** Restores the days of a change. Refuses (unless forced) if any of them was edited afterwards. */
export async function undoChange(id: string, force = false, db: ShiftFlowDB = defaultDb): Promise<UndoResult> {
  return db.transaction('rw', db.entries, db.changes, async () => {
    const cs = await db.changes.get(id)
    if (!cs || cs.undone) return { ok: true }
    let conflicts = 0
    for (const a of cs.after) if (!sameEntry(await db.entries.get(a.date), a.entry)) conflicts++
    if (conflicts && !force) return { ok: false, conflicts }
    for (const b of cs.before) {
      if (b.entry) await db.entries.put(b.entry)
      else await db.entries.delete(b.date)
    }
    await db.changes.update(id, { undone: true })
    return { ok: true }
  })
}

export async function lastUndoable(db: ShiftFlowDB = defaultDb) {
  const all = await db.changes.orderBy('createdAt').reverse().toArray()
  return all.find((c) => !c.undone)
}
