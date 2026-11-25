import type { DateKey, ShiftEntry, ShiftType } from '@/domain/types'
import { daysInMonth, toKey } from '@/domain/time'
import type { EntryUpdate } from '@/data/repo'

export interface RawItem {
  date: DateKey
  code: string
}

export interface ParsedRoster {
  format: 'roster-json' | 'csv'
  items: RawItem[]
  /** All people found in a multi-person roster. */
  people: string[]
  /** Whose row was read. */
  person?: string
  months: string[]
  skippedLines: number
}

export class ImportError extends Error {}

/**
 * Reads a roster. Supported now:
 * - JSON in the ShiftWidget format: { me?, months: { "YYYY-MM": { "Name": ["063", "AFR", …] } } }
 * - CSV/TSV: one day per line, "date,code" (date as YYYY-MM-DD or DD.MM.YYYY), optional header.
 * Only one person's row is ever read.
 */
export function parseRoster(text: string, person?: string): ParsedRoster {
  const trimmed = text.replace(/^﻿/, '').trim()
  if (!trimmed) throw new ImportError('empty')
  if (trimmed.startsWith('{')) return parseRosterJson(trimmed, person)
  return parseCsv(trimmed)
}

function parseRosterJson(text: string, person?: string): ParsedRoster {
  let j: unknown
  try {
    j = JSON.parse(text)
  } catch {
    throw new ImportError('invalid JSON')
  }
  const months = (j as { months?: Record<string, Record<string, unknown[]>> }).months
  if (!months || typeof months !== 'object') throw new ImportError('no "months" found')
  const keys = Object.keys(months).filter((k) => /^\d{4}-\d{2}$/.test(k)).sort()
  const people = [...new Set(keys.flatMap((k) => Object.keys(months[k] ?? {})))]
  const me = (j as { me?: string }).me
  const who = person ?? (me && people.includes(me) ? me : people.length === 1 ? people[0] : undefined)
  const res: ParsedRoster = { format: 'roster-json', items: [], people, person: who, months: keys, skippedLines: 0 }
  if (!who) return res
  for (const k of keys) {
    const row = months[k]?.[who]
    if (!Array.isArray(row)) continue
    const [y, m] = k.split('-').map(Number)
    row.slice(0, daysInMonth(y, m)).forEach((c, i) => {
      const code = String(c ?? '').trim()
      if (code) res.items.push({ date: toKey(y, m, i + 1), code })
    })
  }
  return res
}

function parseDate(s: string): DateKey | undefined {
  const t = s.trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t)
  if (m) return valid(+m[1], +m[2], +m[3])
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t)
  if (m) return valid(+m[3], +m[2], +m[1])
  return undefined
}

function valid(y: number, m: number, d: number) {
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m) ? toKey(y, m, d) : undefined
}

function parseCsv(text: string): ParsedRoster {
  const items: RawItem[] = []
  let skipped = 0
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return
    const cells = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ''))
    const date = parseDate(cells[0] ?? '')
    if (!date) {
      if (i > 0) skipped++ // first line may be a header
      return
    }
    const code = cells[1] ?? ''
    if (code) items.push({ date, code })
  })
  if (!items.length) throw new ImportError('no "date,code" lines found')
  const months = [...new Set(items.map((x) => x.date.slice(0, 7)))].sort()
  return { format: 'csv', items, people: [], months, skippedLines: skipped }
}

export type PreviewStatus = 'new' | 'same' | 'conflict' | 'unknown' | 'ignored'

export interface PreviewItem {
  date: DateKey
  code: string
  typeId?: string
  status: PreviewStatus
  existing?: ShiftEntry
}

export function matchCode(code: string, types: ShiftType[]): ShiftType | undefined {
  const c = code.trim().toUpperCase()
  return types.find((t) => !t.archived && (t.code.toUpperCase() === c || t.aliases.some((a) => a.toUpperCase() === c)))
}

export function buildPreview(
  items: RawItem[], types: ShiftType[], ignore: string[], existing: Map<DateKey, ShiftEntry>,
): PreviewItem[] {
  const ign = new Set(ignore.map((x) => x.toUpperCase()))
  return items.map((it) => {
    const ex = existing.get(it.date)
    if (ign.has(it.code.toUpperCase())) return { ...it, status: 'ignored', existing: ex }
    const t = matchCode(it.code, types)
    if (!t) return { ...it, status: 'unknown', existing: ex }
    if (!ex) return { ...it, typeId: t.id, status: 'new' }
    return { ...it, typeId: t.id, status: ex.shiftTypeId === t.id ? 'same' : 'conflict', existing: ex }
  })
}

export interface ImportChoices {
  /** Dates where the user chose to replace an existing different shift. */
  replace: Set<DateKey>
  /** Shift chosen by the user for unknown codes (missing = skip). */
  assign: Record<DateKey, string>
}

/** Turns the reviewed preview into writes. Never overwrites without an explicit choice. */
export function toUpdates(preview: PreviewItem[], choices: ImportChoices, importId: string): EntryUpdate[] {
  const out: EntryUpdate[] = []
  for (const p of preview) {
    let typeId: string | undefined
    if (p.status === 'new') typeId = p.typeId
    else if (p.status === 'conflict' && choices.replace.has(p.date)) typeId = p.typeId
    else if (p.status === 'unknown') {
      typeId = choices.assign[p.date]
      if (typeId && p.existing && !choices.replace.has(p.date)) typeId = undefined
    }
    if (typeId) out.push({ date: p.date, entry: { shiftTypeId: typeId, source: 'import', importId } })
  }
  return out
}
