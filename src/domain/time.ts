import { TZDate } from '@date-fns/tz'
import type { DateKey, Lang } from './types'

export const TZ = 'Europe/Zurich'

const pad = (n: number) => String(n).padStart(2, '0')

export function toKey(y: number, m: number, d: number): DateKey {
  return `${y}-${pad(m)}-${pad(d)}`
}

export function parseKey(k: DateKey) {
  const [y, m, d] = k.split('-').map(Number)
  return { y, m, d }
}

// Calendar arithmetic on plain dates uses UTC so it never shifts across DST.
function utc(k: DateKey) {
  const { y, m, d } = parseKey(k)
  return Date.UTC(y, m - 1, d)
}

export function addDays(k: DateKey, n: number): DateKey {
  const { y, m, d } = parseKey(k)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return toKey(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}

/** Whole days from a to b (b − a). */
export function diffDays(a: DateKey, b: DateKey) {
  return Math.round((utc(b) - utc(a)) / 86_400_000)
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(k: DateKey) {
  return (new Date(utc(k)).getUTCDay() + 6) % 7
}

export const isWeekend = (k: DateKey) => weekdayIndex(k) >= 5
export const startOfWeek = (k: DateKey) => addDays(k, -weekdayIndex(k))
export const minKey = (a: DateKey, b: DateKey) => (a < b ? a : b)
export const maxKey = (a: DateKey, b: DateKey) => (a > b ? a : b)

export function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function addMonths(y: number, m: number, n: number) {
  const t = y * 12 + (m - 1) + n
  return { y: Math.floor(t / 12), m: (((t % 12) + 12) % 12) + 1 }
}

export function monthRange(y: number, m: number): [DateKey, DateKey] {
  return [toKey(y, m, 1), toKey(y, m, daysInMonth(y, m))]
}

/** 6 weeks × 7 days, starting on the Monday on or before the 1st. */
export function monthGrid(y: number, m: number): DateKey[] {
  const start = startOfWeek(toKey(y, m, 1))
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export function daysBetween(from: DateKey, to: DateKey): DateKey[] {
  const n = diffDays(from, to)
  return n < 0 ? [] : Array.from({ length: n + 1 }, (_, i) => addDays(from, i))
}

export interface ZonedNow {
  key: DateKey
  minutes: number
  ms: number
}

/** "Now" as seen in Zurich, whatever the device time zone is. */
export function zonedNow(ms = Date.now()): ZonedNow {
  const z = new TZDate(ms, TZ)
  return {
    key: toKey(z.getFullYear(), z.getMonth() + 1, z.getDate()),
    minutes: z.getHours() * 60 + z.getMinutes(),
    ms,
  }
}

/** Real instant (epoch ms) of a Zurich wall-clock time; minutes ≥ 1440 roll into the next day. */
export function instantAt(k: DateKey, minutes: number): number {
  let key = k
  let min = minutes
  while (min >= 1440) {
    key = addDays(key, 1)
    min -= 1440
  }
  const { y, m, d } = parseKey(key)
  return new TZDate(y, m - 1, d, Math.floor(min / 60), min % 60, TZ).getTime()
}

export function fmtHM(min: number) {
  const t = ((Math.round(min) % 1440) + 1440) % 1440
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`
}

export function parseHM(s: string): number | undefined {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
  if (!m) return undefined
  const h = Number(m[1])
  const mi = Number(m[2])
  if (h > 23 || mi > 59) return undefined
  return h * 60 + mi
}

export function fmtDuration(min: number, lang: Lang = 'en') {
  const sign = min < 0 ? '−' : ''
  const a = Math.abs(Math.round(min))
  const h = Math.floor(a / 60)
  const m = a % 60
  if (lang === 'de') return `${sign}${h} Std.${m ? ` ${m} Min.` : ''}`
  return `${sign}${h}h${m ? ` ${pad(m)}m` : ''}`
}

export const localeOf = (lang: Lang) => (lang === 'de' ? 'de-CH' : 'en-GB')

/** Formats a date key; the date is treated as a plain calendar day. */
export function fmtDate(k: DateKey, lang: Lang, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(localeOf(lang), { ...opts, timeZone: 'UTC' }).format(new Date(utc(k)))
}

/** Monday-first weekday names. */
export function weekdayNames(lang: Lang, style: 'short' | 'narrow' = 'short') {
  return Array.from({ length: 7 }, (_, i) => fmtDate(addDays('2024-01-01', i), lang, { weekday: style }))
}

export function monthNames(lang: Lang, style: 'long' | 'short' = 'long') {
  return Array.from({ length: 12 }, (_, i) => fmtDate(toKey(2024, i + 1, 1), lang, { month: style }))
}
