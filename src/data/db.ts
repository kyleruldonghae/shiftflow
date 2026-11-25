import Dexie, { type EntityTable } from 'dexie'
import type { ChangeSet, Settings, ShiftEntry, ShiftType } from '@/domain/types'

export class ShiftFlowDB extends Dexie {
  shiftTypes!: EntityTable<ShiftType, 'id'>
  entries!: EntityTable<ShiftEntry, 'date'>
  changes!: EntityTable<ChangeSet, 'id'>
  settings!: EntityTable<Settings, 'id'>

  constructor(name = 'shiftflow') {
    super(name)
    this.version(1).stores({
      shiftTypes: 'id, order',
      entries: 'date, shiftTypeId, source',
      changes: 'id, createdAt, kind',
      settings: 'id',
    })
  }
}

export const db = new ShiftFlowDB()
