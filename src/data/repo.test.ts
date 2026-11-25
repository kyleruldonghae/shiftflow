import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { ShiftFlowDB } from './db'
import { ensureSeeded } from './defaults'
import { commit, lastUndoable, undoChange } from './repo'
import { buildPreview, parseRoster, toUpdates } from '@/services/import/rosterImport'

let db: ShiftFlowDB
beforeEach(async () => {
  db = new ShiftFlowDB(`test-${Math.random()}`)
  await ensureSeeded(db)
})

const put = (date: string, shiftTypeId: string) => ({ date, entry: { shiftTypeId, source: 'manual' as const } })

describe('persistence and undo', () => {
  it('persists entries and records changes', async () => {
    await commit('a', 'edit', [put('2026-12-01', 'early')], { db })
    expect((await db.entries.get('2026-12-01'))?.shiftTypeId).toBe('early')
    expect(await db.changes.count()).toBe(1)
  })

  it('undo restores the previous state, including removals', async () => {
    await commit('a', 'edit', [put('2026-12-01', 'early')], { db })
    const cs = await commit('b', 'bulk', [put('2026-12-01', 'late'), put('2026-12-02', 'late')], { db })
    expect(await undoChange(cs.id, false, db)).toEqual({ ok: true })
    expect((await db.entries.get('2026-12-01'))?.shiftTypeId).toBe('early')
    expect(await db.entries.get('2026-12-02')).toBeUndefined()
    expect((await lastUndoable(db))?.label).toBe('a')
  })

  it('refuses undo when a day was edited afterwards, unless forced', async () => {
    const cs = await commit('a', 'edit', [put('2026-12-01', 'early')], { db })
    await new Promise((r) => setTimeout(r, 2))
    await commit('b', 'edit', [put('2026-12-01', 'late')], { db })
    expect(await undoChange(cs.id, false, db)).toEqual({ ok: false, conflicts: 1 })
    expect(await undoChange(cs.id, true, db)).toEqual({ ok: true })
    expect(await db.entries.get('2026-12-01')).toBeUndefined()
  })
})

describe('roster import', () => {
  const roster = JSON.stringify({
    me: 'Me Myself',
    months: {
      '2026-12': {
        'Someone Else': ['14', '223'],
        'Me Myself': ['AFR', '14', 'EFG', '063', 'FE', 'XYZ', 'WU', ''],
      },
    },
  })

  it('reads only my row', () => {
    const r = parseRoster(roster)
    expect(r.person).toBe('Me Myself')
    expect(r.people).toEqual(['Someone Else', 'Me Myself'])
    expect(r.items.map((i) => i.code)).toEqual(['AFR', '14', 'EFG', '063', 'FE', 'XYZ', 'WU'])
  })

  it('maps aliases, leaves out ignored codes and flags unknown ones', async () => {
    const types = await db.shiftTypes.toArray()
    const p = buildPreview(parseRoster(roster).items, types, ['EFG', 'EFH'], new Map())
    expect(p.map((x) => [x.code, x.typeId, x.status])).toEqual([
      ['AFR', 'off', 'new'], ['14', 'late', 'new'], ['EFG', undefined, 'ignored'], ['063', 'early', 'new'],
      ['FE', 'vacation', 'new'], ['XYZ', undefined, 'unknown'], ['WU', 'wish', 'new'],
    ])
  })

  it('never overwrites an existing different shift without an explicit choice', async () => {
    await commit('mine', 'edit', [put('2026-12-02', 'early')], { db })
    const types = await db.shiftTypes.toArray()
    const existing = new Map((await db.entries.toArray()).map((x) => [x.date, x]))
    const p = buildPreview(parseRoster(roster).items, types, ['EFG'], existing)
    expect(p.find((x) => x.date === '2026-12-02')?.status).toBe('conflict')
    const keep = toUpdates(p, { replace: new Set(), assign: {} }, 'imp')
    expect(keep.some((u) => u.date === '2026-12-02')).toBe(false)
    expect(keep.some((u) => u.date === '2026-12-06')).toBe(false) // unknown XYZ skipped
    const replace = toUpdates(p, { replace: new Set(['2026-12-02']), assign: { '2026-12-06': 'sick' } }, 'imp')
    expect(replace.find((u) => u.date === '2026-12-02')?.entry?.shiftTypeId).toBe('late')
    expect(replace.find((u) => u.date === '2026-12-06')?.entry?.shiftTypeId).toBe('sick')
  })

  it('reads CSV with header and Swiss dates', () => {
    const r = parseRoster('date,code\n2026-12-01,AFR\n02.12.2026;14\nbad line\n')
    expect(r.items).toEqual([{ date: '2026-12-01', code: 'AFR' }, { date: '2026-12-02', code: '14' }])
    expect(r.skippedLines).toBe(1)
  })
})
