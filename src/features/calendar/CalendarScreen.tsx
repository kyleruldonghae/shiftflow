import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, ChevronLeft, ChevronRight, ClipboardPaste, Copy, ListChecks, Pencil, Trash2, Undo2, X } from 'lucide-react'
import type { DateKey, ShiftEntry } from '@/domain/types'
import { addDays, addMonths, fmtDate, monthGrid, monthNames, parseKey, startOfWeek } from '@/domain/time'
import { useEntries, useNow, useShiftTypes } from '@/data/hooks'
import { lastUndoable, undoChange } from '@/data/repo'
import { db } from '@/data/db'
import { useI18n } from '@/i18n'
import { useApp } from '@/app/context'
import { useCommit } from '@/app/useCommit'
import { cn } from '@/lib/utils'
import { Button, IconButton } from '@/ui/Button'
import { Segmented } from '@/ui/Segmented'
import { Sheet } from '@/ui/Sheet'
import { TypeGrid } from '@/ui/ShiftChip'
import { useToast } from '@/ui/Toast'
import { useConfirm } from '@/ui/useConfirm'
import { MonthGrid } from './MonthGrid'
import { WeekView } from './WeekView'
import { AgendaView } from './AgendaView'

type View = 'month' | 'week' | 'agenda'
type Clip = Pick<ShiftEntry, 'shiftTypeId' | 'startMin' | 'endMin' | 'breakMin' | 'breakPaid' | 'note'>

const CLIP_KEY = 'sf-clipboard'
function readClip(): Clip | null {
  try {
    return JSON.parse(sessionStorage.getItem(CLIP_KEY) ?? 'null')
  } catch {
    return null
  }
}

export function CalendarScreen() {
  const { t, lang } = useI18n()
  const now = useNow(60_000)
  const today = now.key
  const { active, map: types } = useShiftTypes()
  const { openEditor, setFocusDate } = useApp()
  const save = useCommit()
  const toast = useToast()
  const [confirmEl, confirm] = useConfirm()

  const [view, setView] = useState<View>('month')
  const [cursor, setCursor] = useState(() => parseKey(today))
  const [dir, setDir] = useState(0)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today))
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<DateKey>>(new Set())
  const [clip, setClip] = useState<Clip | null>(readClip)
  const [quick, setQuick] = useState<DateKey | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const lastChange = useLiveQuery(() => lastUndoable(), [])

  const grid = monthGrid(cursor.y, cursor.m)
  const { map: entries } = useEntries(grid[0], grid[41])
  const quickEntry = useLiveQuery(async () => (quick ? { e: await db.entries.get(quick) } : undefined), [quick])?.e

  const goMonth = (n: number) => {
    setDir(n)
    setCursor((c) => ({ ...c, ...addMonths(c.y, c.m, n) }))
  }
  const goToday = () => {
    const p = parseKey(today)
    setDir(p.y * 12 + p.m < cursor.y * 12 + cursor.m ? -1 : 1)
    setCursor(p)
    setWeekStart(startOfWeek(today))
  }
  const endSelect = () => {
    setSelecting(false)
    setSelected(new Set())
  }
  const toggle = (d: DateKey) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(d)) n.delete(d)
      else n.add(d)
      return n
    })

  const onTap = (d: DateKey) => {
    if (selecting) return toggle(d)
    setFocusDate(d)
    openEditor(d)
  }
  const onLongPress = (d: DateKey) => {
    setFocusDate(d)
    if (selecting) return toggle(d)
    setQuick(d)
  }

  const assign = async (dates: DateKey[], typeId: string) => {
    const type = types.get(typeId)
    await save(t('cal.assigned', { code: type?.code ?? '', n: dates.length }), dates.length > 1 ? 'bulk' : 'edit',
      dates.map((date) => ({ date, entry: { shiftTypeId: typeId, source: 'manual' } })))
  }
  const copy = (e: ShiftEntry) => {
    const c: Clip = { shiftTypeId: e.shiftTypeId, startMin: e.startMin, endMin: e.endMin, breakMin: e.breakMin, breakPaid: e.breakPaid, note: e.note }
    setClip(c)
    try {
      sessionStorage.setItem(CLIP_KEY, JSON.stringify(c))
    } catch {
      /* ignore */
    }
    toast({ text: t('cal.copied', { code: types.get(e.shiftTypeId)?.code ?? '' }) })
  }
  const paste = async (dates: DateKey[]) => {
    if (!clip) return
    await save(t('cal.pasted', { code: types.get(clip.shiftTypeId)?.code ?? '', n: dates.length }), 'paste',
      dates.map((date) => ({ date, entry: { ...clip, source: 'manual' } })))
  }
  const clear = async (dates: DateKey[]) => {
    const existing = dates.filter((d) => entries.has(d) || d === quick)
    await save(t('cal.cleared', { n: existing.length }), 'clear', existing.map((date) => ({ date, entry: null })))
  }
  const undo = async () => {
    if (!lastChange) return toast({ text: t('cal.nothingToUndo') })
    let res = await undoChange(lastChange.id)
    if (!res.ok) {
      const ok = await confirm({
        title: t('cal.undoConflictTitle'),
        message: t('cal.undoConflictText', { n: res.conflicts }),
        confirmLabel: t('cal.undoAnyway'),
      })
      if (!ok) return
      res = await undoChange(lastChange.id, true)
    }
    toast({ text: t('cal.undone', { label: lastChange.label }) })
  }

  const months = monthNames(lang, 'long')
  const title =
    view === 'week'
      ? `${fmtDate(weekStart, lang, { day: 'numeric', month: 'short' })} – ${fmtDate(addDays(weekStart, 6), lang, { day: 'numeric', month: 'short' })}`
      : view === 'agenda'
        ? t('cal.agenda')
        : `${months[cursor.m - 1]} ${cursor.y}`
  const selectedList = [...selected].sort()

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-1 px-1 pt-2">
        <button
          type="button"
          onClick={() => view === 'month' && setPickerOpen(true)}
          className="flex min-w-0 items-center gap-1 text-left"
          disabled={view !== 'month'}
        >
          <h1 className="truncate text-[24px] font-semibold tracking-tight sm:text-[28px]">{title}</h1>
          {view === 'month' && <ChevronDown className="mt-1 size-5 shrink-0 text-muted" />}
        </button>
        <div className="ml-auto flex items-center gap-1">
          <IconButton aria-label={t('common.undo')} onClick={undo} disabled={!lastChange}><Undo2 /></IconButton>
          <Button variant="secondary" size="sm" onClick={goToday}>{t('common.today')}</Button>
        </div>
      </header>

      <div className="flex items-center gap-2">
        <Segmented
          id="calview"
          value={view}
          onChange={(v) => {
            setView(v)
            endSelect()
          }}
          options={[
            { value: 'month', label: t('cal.month') },
            { value: 'week', label: t('cal.week') },
            { value: 'agenda', label: t('cal.agenda') },
          ]}
          className="flex-1"
        />
        {view !== 'agenda' && (
          <div className="flex">
            <IconButton aria-label={t('common.prev')} onClick={() => (view === 'month' ? goMonth(-1) : setWeekStart((w) => addDays(w, -7)))}>
              <ChevronLeft />
            </IconButton>
            <IconButton aria-label={t('common.next')} onClick={() => (view === 'month' ? goMonth(1) : setWeekStart((w) => addDays(w, 7)))}>
              <ChevronRight />
            </IconButton>
          </div>
        )}
      </div>

      {view === 'month' && (
        <>
          <div className="flex items-center justify-between px-1">
            <p className="text-[13px] text-muted">{selecting ? t('cal.selectHint') : ' '}</p>
            <button
              type="button"
              onClick={() => (selecting ? endSelect() : setSelecting(true))}
              className={cn('inline-flex items-center gap-1.5 text-[14px] font-semibold', selecting ? 'text-fg' : 'text-accent')}
            >
              {selecting ? <X className="size-4" /> : <ListChecks className="size-4" />}
              {selecting ? t('common.done') : t('cal.select')}
            </button>
          </div>
          <MonthGrid
            month={cursor}
            dir={dir}
            grid={grid}
            entries={entries}
            types={types}
            today={today}
            selected={selected}
            onTap={onTap}
            onLongPress={onLongPress}
            onSwipe={goMonth}
          />
        </>
      )}
      {view === 'week' && <WeekView weekStart={weekStart} today={today} types={types} onTap={onTap} />}
      {view === 'agenda' && <AgendaView today={today} types={types} onTap={onTap} />}

      {/* Selection action bar */}
      <AnimatePresence>
        {selecting && (
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+150px)] z-40 px-4"
          >
            <div className="mx-auto flex max-w-[608px] items-center gap-2 rounded-[20px] border border-line/70 bg-card p-2 shadow-elev">
              <span className="pl-2 text-[14px] font-semibold tabular-nums">{t('cal.selected', { n: selected.size })}</span>
              <div className="ml-auto flex gap-1.5">
                <Button size="sm" disabled={!selected.size} onClick={() => setBulkOpen(true)}>{t('cal.assign')}</Button>
                <Button size="sm" variant="secondary" disabled={!selected.size || !clip} onClick={async () => { await paste(selectedList); endSelect() }}>
                  <ClipboardPaste />
                </Button>
                <Button size="sm" variant="danger" disabled={!selectedList.some((d) => entries.has(d))} onClick={async () => { await clear(selectedList); endSelect() }}>
                  <Trash2 />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Long-press quick actions */}
      <Sheet open={!!quick} onClose={() => setQuick(null)} title={quick ? fmtDate(quick, lang, { weekday: 'long', day: 'numeric', month: 'long' }) : ''} closeLabel={t('common.close')}>
        <p className="mb-2.5 text-[13px] font-medium text-muted">{t('cal.assignShift')}</p>
        <TypeGrid
          types={active}
          selectedId={quickEntry?.shiftTypeId}
          onPick={async (id) => {
            const d = quick!
            setQuick(null)
            await assign([d], id)
          }}
        />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => { const d = quick!; setQuick(null); openEditor(d) }}>
            <Pencil /> {t('cal.editDetails')}
          </Button>
          <Button variant="secondary" onClick={() => { const d = quick!; setQuick(null); setSelecting(true); setSelected(new Set([d])) }}>
            <ListChecks /> {t('cal.selectMore')}
          </Button>
          <Button variant="secondary" disabled={!quickEntry} onClick={() => { if (quickEntry) copy(quickEntry); setQuick(null) }}>
            <Copy /> {t('cal.copy')}
          </Button>
          <Button variant="secondary" disabled={!clip} onClick={async () => { const d = quick!; setQuick(null); await paste([d]) }}>
            <ClipboardPaste /> {t('cal.paste')}
          </Button>
          {quickEntry && (
            <Button variant="danger" className="col-span-2" onClick={async () => { const d = quick!; setQuick(null); await clear([d]) }}>
              <Trash2 /> {t('cal.clearDay')}
            </Button>
          )}
        </div>
      </Sheet>

      {/* Bulk assign */}
      <Sheet open={bulkOpen} onClose={() => setBulkOpen(false)} title={t('cal.selected', { n: selected.size })} closeLabel={t('common.close')}>
        <p className="mb-2.5 text-[13px] font-medium text-muted">{t('cal.assignShift')}</p>
        <TypeGrid
          types={active}
          onPick={async (id) => {
            setBulkOpen(false)
            await assign(selectedList, id)
            endSelect()
          }}
        />
      </Sheet>

      {/* Month & year picker */}
      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title={t('cal.pickMonth')} closeLabel={t('common.close')}>
        <div className="mb-4 flex items-center justify-between rounded-2xl bg-field p-1.5">
          <IconButton aria-label={t('common.prev')} onClick={() => setCursor((c) => ({ ...c, y: c.y - 1 }))}><ChevronLeft /></IconButton>
          <span className="text-[17px] font-semibold tabular-nums">{cursor.y}</span>
          <IconButton aria-label={t('common.next')} onClick={() => setCursor((c) => ({ ...c, y: c.y + 1 }))}><ChevronRight /></IconButton>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {monthNames(lang, 'short').map((name, i) => {
            const isCur = i + 1 === cursor.m
            const isNow = cursor.y === parseKey(today).y && i + 1 === parseKey(today).m
            return (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setDir(i + 1 > cursor.m ? 1 : -1)
                  setCursor((c) => ({ ...c, m: i + 1 }))
                  setPickerOpen(false)
                }}
                className={cn(
                  'h-12 rounded-2xl text-[15px] font-semibold transition active:scale-95',
                  isCur ? 'bg-accent text-accent-fg' : 'bg-field',
                  !isCur && isNow && 'ring-2 ring-accent/60',
                )}
              >
                {name}
              </button>
            )
          })}
        </div>
      </Sheet>
      {confirmEl}
    </div>
  )
}
