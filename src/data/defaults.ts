import type { Settings, ShiftKind, ShiftType } from '@/domain/types'
import type { ShiftFlowDB } from './db'

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  theme: 'system',
  language: 'en',
  name: '',
  vacationDaysPerYear: 35,
  publicHolidaysPerYear: 8,
  defaultLocation: '',
  // Einführungstag Stiftung Group / Hotel – one-off, left out of imports
  importIgnore: ['EFG', 'EFH'],
}

let order = 0
function type(
  id: string, code: string, aliases: string[], name: string, kind: ShiftKind, color: string,
  startMin?: number, endMin?: number,
): ShiftType {
  // Breaks are deliberately left unset until the contract is confirmed.
  return { id, code, aliases, name, kind, color, startMin, endMin, breakPaid: false, archived: false, order: order++ }
}

/** Times confirmed by the user on 2026-11-25. */
export const DEFAULT_SHIFT_TYPES: ShiftType[] = [
  type('early', '63', ['063'], 'Early shift', 'work', '#B8D8C0', 390, 930),
  type('day', '10', [], 'Day shift', 'work', '#B8D5EF', 600, 1140),
  type('mid', '11', [], 'Mid shift', 'work', '#D4C5ED', 660, 1200),
  type('late', '14', [], 'Late shift', 'work', '#F2C49E', 840, 1380),
  type('off', 'OFF', ['AFR', 'FR'], 'Day off', 'off', '#C4CCD0'),
  type('wish', 'WU', ['FREIWUNSCH'], 'Requested day off', 'off', '#CBDDE6'),
  type('vacation', 'FER', ['FE', 'FE*'], 'Vacation', 'vacation', '#F0D98C'),
  type('sick', 'SICK', [], 'Sick leave', 'sick', '#E8A5A5'),
  type('ph', 'PH', [], 'Public holiday', 'publicHoliday', '#8DD5D1'),
]

export async function ensureSeeded(db: ShiftFlowDB) {
  await db.transaction('rw', db.shiftTypes, db.settings, async () => {
    if ((await db.shiftTypes.count()) === 0) await db.shiftTypes.bulkAdd(DEFAULT_SHIFT_TYPES)
    if (!(await db.settings.get('app'))) await db.settings.add(DEFAULT_SETTINGS)
  })
}
