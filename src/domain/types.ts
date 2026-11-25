// Core data model. All times are minutes after midnight (390 = 06:30), durations are minutes.

/** Local calendar date in Europe/Zurich, "YYYY-MM-DD". */
export type DateKey = string

export type ShiftKind = 'work' | 'off' | 'vacation' | 'sick' | 'publicHoliday'

export interface ShiftType {
  id: string
  code: string
  /** Other codes that mean this shift in the employer's roster, e.g. "063". */
  aliases: string[]
  name: string
  kind: ShiftKind
  color: string
  startMin?: number
  /** End ≤ start means the shift ends the next day. */
  endMin?: number
  /** Undefined = not configured yet (net time is then not calculated). */
  breakMin?: number
  breakPaid: boolean
  location?: string
  archived: boolean
  order: number
}

export interface ShiftEntry {
  date: DateKey
  shiftTypeId: string
  /** Per-day overrides; undefined = use the shift type's value. */
  startMin?: number
  endMin?: number
  breakMin?: number
  breakPaid?: boolean
  /** What was really worked, for overtime. */
  actualStartMin?: number
  actualEndMin?: number
  note?: string
  source: 'manual' | 'import' | 'demo'
  importId?: string
  updatedAt: number
}

export type Theme = 'system' | 'light' | 'dark'
export type Lang = 'en' | 'de'

export interface Settings {
  id: 'app'
  theme: Theme
  language: Lang
  name: string
  /** Undefined until the user confirms their contract. */
  weeklyTargetMin?: number
  vacationDaysPerYear: number
  publicHolidaysPerYear: number
  defaultLocation: string
  /** Roster codes that imports leave out (e.g. one-off training days). */
  importIgnore: string[]
}

export interface ChangeItem {
  date: DateKey
  entry?: ShiftEntry
}

export type ChangeKind = 'edit' | 'bulk' | 'paste' | 'clear' | 'import' | 'demo'

/** Every write to shift entries is recorded, so it can be undone safely. */
export interface ChangeSet {
  id: string
  createdAt: number
  label: string
  kind: ChangeKind
  before: ChangeItem[]
  after: ChangeItem[]
  undone?: boolean
  importMeta?: { source: string; count: number }
}
