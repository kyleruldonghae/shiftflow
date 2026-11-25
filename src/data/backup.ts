import type { ChangeSet, Settings, ShiftEntry, ShiftType } from '@/domain/types'
import { db } from './db'
import { ensureSeeded } from './defaults'

export interface Backup {
  app: 'ShiftFlow'
  format: 1
  exportedAt: string
  settings: Settings
  shiftTypes: ShiftType[]
  entries: ShiftEntry[]
  changes: ChangeSet[]
}

export async function createBackup(): Promise<Backup> {
  return {
    app: 'ShiftFlow',
    format: 1,
    exportedAt: new Date().toISOString(),
    settings: (await db.settings.get('app'))!,
    shiftTypes: await db.shiftTypes.toArray(),
    entries: await db.entries.toArray(),
    changes: await db.changes.toArray(),
  }
}

export function isBackup(x: unknown): x is Backup {
  const b = x as Backup
  return !!b && b.app === 'ShiftFlow' && b.format === 1 && Array.isArray(b.shiftTypes) && Array.isArray(b.entries) && !!b.settings
}

export async function restoreBackup(b: Backup) {
  await db.transaction('rw', [db.settings, db.shiftTypes, db.entries, db.changes], async () => {
    await Promise.all([db.settings.clear(), db.shiftTypes.clear(), db.entries.clear(), db.changes.clear()])
    await db.settings.add({ ...b.settings, id: 'app' })
    await db.shiftTypes.bulkAdd(b.shiftTypes)
    await db.entries.bulkAdd(b.entries)
    await db.changes.bulkAdd(b.changes ?? [])
  })
}

export async function deleteAllData() {
  await db.transaction('rw', [db.settings, db.shiftTypes, db.entries, db.changes], async () => {
    await Promise.all([db.settings.clear(), db.shiftTypes.clear(), db.entries.clear(), db.changes.clear()])
  })
  await ensureSeeded(db)
}
