import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { DateKey, Settings, ShiftEntry } from '@/domain/types'
import { zonedNow, type ZonedNow } from '@/domain/time'
import { db } from './db'

export function useSettings() {
  return useLiveQuery(() => db.settings.get('app'))
}

export async function updateSettings(patch: Partial<Settings>) {
  await db.settings.update('app', patch)
}

export function useShiftTypes() {
  const list = useLiveQuery(() => db.shiftTypes.orderBy('order').toArray())
  const map = useMemo(() => new Map((list ?? []).map((t) => [t.id, t])), [list])
  const active = useMemo(() => (list ?? []).filter((t) => !t.archived), [list])
  return { list: list ?? [], active, map, ready: list !== undefined }
}

export function useEntries(from: DateKey, to: DateKey) {
  const entries = useLiveQuery(() => db.entries.where('date').between(from, to, true, true).toArray(), [from, to])
  const map = useMemo(() => new Map<DateKey, ShiftEntry>((entries ?? []).map((e) => [e.date, e])), [entries])
  return { entries: entries ?? [], map, ready: entries !== undefined }
}

export function useChanges(limit = 30) {
  return useLiveQuery(() => db.changes.orderBy('createdAt').reverse().limit(limit).toArray()) ?? []
}

/** Current Zurich time, refreshed every interval and when the app comes back to the foreground. */
export function useNow(intervalMs = 30_000): ZonedNow {
  const [now, setNow] = useState(() => zonedNow())
  useEffect(() => {
    const tick = () => setNow(zonedNow())
    const id = window.setInterval(tick, intervalMs)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [intervalMs])
  return now
}
