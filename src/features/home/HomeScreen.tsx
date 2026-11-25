import { useMemo, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { CalendarClock, ChevronLeft, ChevronRight, Coffee, Hourglass, Sparkles, TreePalm } from 'lucide-react'
import type { DateKey, Settings, ShiftEntry, ShiftType } from '@/domain/types'
import {
  addDays, diffDays, fmtDate, fmtDuration, fmtHM, maxKey, monthRange, parseKey, startOfWeek, weekdayNames, type ZonedNow,
} from '@/domain/time'
import { resolve, summarize } from '@/domain/shiftCalc'
import { blocksOfKind, countKind } from '@/domain/holidays'
import { useEntries, useNow, useShiftTypes } from '@/data/hooks'
import { removeDemo } from '@/data/demo'
import { useI18n, type TFn } from '@/i18n'
import { useApp, useAppSettings } from '@/app/context'
import { cn } from '@/lib/utils'
import { Card, EmptyState, SectionTitle } from '@/ui/Card'
import { IconButton } from '@/ui/Button'
import { ShiftChip } from '@/ui/ShiftChip'
import { useToast } from '@/ui/Toast'
import { TodayCard } from './TodayCard'
import { todayState, type TodayState } from './todayState'

export function HomeScreen() {
  const { t, lang } = useI18n()
  const now = useNow()
  const settings = useAppSettings()
  const { map: types } = useShiftTypes()
  const today = now.key
  const { y } = parseKey(today)
  // Whole year (vacation count) plus 90 days ahead (upcoming)
  const { entries, map } = useEntries(`${y}-01-01`, maxKey(`${y}-12-31`, addDays(today, 90)))

  const state = todayState(now, map.get(today), map.get(addDays(today, -1)), types)
  const future = useMemo(() => entries.filter((e) => e.date > today).sort((a, b) => (a.date < b.date ? -1 : 1)), [entries, today])
  const nextWork = future.find((e) => types.get(e.shiftTypeId)?.kind === 'work')
  const hasDemo = entries.some((e) => e.source === 'demo')

  return (
    <div className="space-y-6">
      <Greeting now={now} state={state} name={settings.name} t={t} lang={lang} />
      {hasDemo && <DemoBanner />}
      <TodayCard state={state} now={now} nextWork={nextWork} types={types} settings={settings} />
      <WeekStrip today={today} types={types} />
      <QuickStats today={today} entries={entries} future={future} types={types} settings={settings} />
      <Upcoming today={today} future={future} types={types} />
    </div>
  )
}

function Greeting({ now, state, name, t, lang }: { now: ZonedNow; state: TodayState; name: string; t: TFn; lang: 'en' | 'de' }) {
  const h = now.minutes / 60
  const greet = h < 5 ? t('greet.night') : h < 12 ? t('greet.morning') : h < 18 ? t('greet.afternoon') : t('greet.evening')
  let overview = t('home.overviewNone')
  if (state.kind === 'off') overview = t('home.overviewOff', { shift: state.type.name })
  if (state.kind === 'upcoming' || state.kind === 'notimes') {
    const time = state.r.startMin != null && state.r.endMin != null ? `${fmtHM(state.r.startMin)}–${fmtHM(state.r.endMin)}` : state.r.type.code
    overview = t('home.overviewWork', { shift: state.r.type.name, time })
  }
  if (state.kind === 'active') overview = t('home.overviewActive', { time: fmtHM(state.r.endMin!) })
  if (state.kind === 'done') overview = t('home.overviewDone')
  return (
    <header className="px-1 pt-2">
      <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">
        {fmtDate(now.key, lang, { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>
      <h1 className="mt-1 text-[30px] font-semibold leading-tight tracking-tight">
        {greet}
        {name ? `, ${name}` : ''}
      </h1>
      <p className="mt-1 text-[15px] text-muted">{overview}</p>
    </header>
  )
}

function DemoBanner() {
  const { t } = useI18n()
  const toast = useToast()
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#F0D98C]/60 bg-[#F0D98C]/20 px-4 py-2.5 text-[13px]">
      <Sparkles className="size-4 shrink-0 text-[#B8961F] dark:text-[#F0D98C]" />
      <span className="flex-1">{t('home.demoBanner')}</span>
      <button
        type="button"
        className="font-semibold text-accent"
        onClick={async () => {
          await removeDemo(t('settings.demoRemoved'))
          toast({ text: t('settings.demoRemoved') })
        }}
      >
        {t('home.demoRemove')}
      </button>
    </div>
  )
}

function WeekStrip({ today, types }: { today: DateKey; types: Map<string, ShiftType> }) {
  const { t, lang } = useI18n()
  const { openEditor } = useApp()
  const [offset, setOffset] = useState(0)
  const start = addDays(startOfWeek(today), offset * 7)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const { map } = useEntries(days[0], days[6])
  const names = weekdayNames(lang, 'short')

  return (
    <section>
      <SectionTitle
        action={
          <div className="-mr-2 flex items-center">
            {offset !== 0 && (
              <button type="button" onClick={() => setOffset(0)} className="mr-1 text-[13px] font-semibold text-accent">
                {t('common.today')}
              </button>
            )}
            <IconButton aria-label={t('common.prev')} onClick={() => setOffset((o) => o - 1)} className="size-8"><ChevronLeft /></IconButton>
            <IconButton aria-label={t('common.next')} onClick={() => setOffset((o) => o + 1)} className="size-8"><ChevronRight /></IconButton>
          </div>
        }
      >
        {offset === 0 ? t('week.title') : t('week.other', { date: fmtDate(start, lang, { day: 'numeric', month: 'short' }) })}
      </SectionTitle>
      <motion.div
        key={start}
        initial={{ opacity: 0, x: offset >= 0 ? 12 : -12 }}
        animate={{ opacity: 1, x: 0 }}
        className="grid grid-cols-7 gap-1.5"
      >
        {days.map((d, i) => {
          const e = map.get(d)
          const type = e ? types.get(e.shiftTypeId) : undefined
          const isToday = d === today
          return (
            <button
              key={d}
              type="button"
              onClick={() => openEditor(d)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-2xl border py-2.5 transition active:scale-95',
                isToday ? 'border-accent/70 bg-accent/12' : 'border-line/60 bg-card',
              )}
            >
              <span className={cn('text-[11px] font-semibold uppercase', isToday ? 'text-accent' : 'text-muted')}>{names[i]}</span>
              <span className="text-[16px] font-semibold tabular-nums">{parseKey(d).d}</span>
              {type ? <ShiftChip type={type} size="xs" /> : <span className="h-[18px] text-[11px] text-muted/60">–</span>}
            </button>
          )
        })}
      </motion.div>
    </section>
  )
}

function QuickStats({ today, entries, future, types, settings }: {
  today: DateKey; entries: ShiftEntry[]; future: ShiftEntry[]; types: Map<string, ShiftType>; settings: Settings
}) {
  const { t, lang } = useI18n()
  const { goTo, openEditor } = useApp()
  const { y, m } = parseKey(today)
  const [mStart, mEnd] = monthRange(y, m)
  const month = summarize(entries.filter((e) => e.date >= mStart && e.date <= mEnd), types)
  const taken = countKind(entries, types, 'vacation', `${y}-01-01`, today)
  const planned = countKind(entries, types, 'vacation', addDays(today, 1), `${y}-12-31`)
  const remaining = settings.vacationDaysPerYear - taken - planned
  const nextOff = future.find((e) => types.get(e.shiftTypeId)?.kind !== 'work')
  const offLeft = future.filter((e) => e.date <= mEnd && types.get(e.shiftTypeId)?.kind !== 'work').length

  return (
    <section className="grid grid-cols-2 gap-3">
      <Stat
        icon={<CalendarClock />}
        label={t('qs.hours')}
        value={fmtDuration(month.grossMin, lang)}
        sub={month.netMin != null && month.workDays ? t('qs.hoursNet', { d: fmtDuration(month.netMin, lang) }) : t('qs.hoursSub', { n: month.workDays })}
        onClick={() => goTo('stats')}
      />
      <Stat
        icon={<Hourglass />}
        label={t('qs.overtime')}
        value={t('qs.notSetUp')}
        sub={t('qs.overtimeHint')}
        muted
        onClick={() => goTo('settings')}
      />
      <Stat
        icon={<TreePalm />}
        label={t('qs.vacation')}
        value={t('common.days', { n: remaining })}
        sub={t('qs.vacationSub', { used: taken, planned })}
        onClick={() => goTo('holidays')}
      />
      <Stat
        icon={<Coffee />}
        label={t('qs.nextOff')}
        value={nextOff ? fmtDate(nextOff.date, lang, { weekday: 'short', day: 'numeric', month: 'short' }) : t('qs.noneOff')}
        sub={nextOff ? (diffDays(today, nextOff.date) === 1 ? t('common.tomorrow') : t('qs.inDays', { n: diffDays(today, nextOff.date) })) + ` · ${offLeft}×` : undefined}
        onClick={nextOff ? () => openEditor(nextOff.date) : undefined}
      />
    </section>
  )
}

function Stat({ icon, label, value, sub, onClick, muted }: {
  icon: ReactNode; label: string; value: string; sub?: string; onClick?: () => void; muted?: boolean
}) {
  return (
    <Card className="p-0">
      <button type="button" onClick={onClick} disabled={!onClick} className="flex h-full w-full flex-col items-start gap-1 p-4 text-left transition active:scale-[0.98] disabled:cursor-default">
        <span className="mb-1 grid size-8 place-items-center rounded-xl bg-accent/12 text-accent [&_svg]:size-[17px]">{icon}</span>
        <span className="text-[12px] font-medium text-muted">{label}</span>
        <span className={cn('text-[19px] font-semibold leading-tight tracking-tight', muted && 'text-[16px] text-muted')}>{value}</span>
        {sub && <span className="text-[11.5px] leading-snug text-muted">{sub}</span>}
      </button>
    </Card>
  )
}

interface UpItem {
  from: DateKey
  to: DateKey
  type: ShiftType
  entry: ShiftEntry
}

function Upcoming({ today, future, types }: { today: DateKey; future: ShiftEntry[]; types: Map<string, ShiftType> }) {
  const { t, lang } = useI18n()
  const { openEditor } = useApp()

  const items = useMemo(() => {
    // Collapse consecutive non-work days of the same type into one row (e.g. a vacation week)
    const nonWorkBlocks = new Map<DateKey, { to: DateKey }>()
    for (const kind of ['off', 'vacation', 'sick', 'publicHoliday'] as const) {
      for (const b of blocksOfKind(future, types, kind)) nonWorkBlocks.set(b.from, { to: b.to })
    }
    const out: UpItem[] = []
    let skipUntil = ''
    for (const e of future) {
      if (e.date <= skipUntil) continue
      const type = types.get(e.shiftTypeId)
      if (!type) continue
      const block = type.kind !== 'work' ? nonWorkBlocks.get(e.date) : undefined
      out.push({ from: e.date, to: block?.to ?? e.date, type, entry: e })
      if (block) skipUntil = block.to
      if (out.length >= 7) break
    }
    return out
  }, [future, types])

  return (
    <section>
      <SectionTitle>{t('up.title')}</SectionTitle>
      <Card className="divide-y divide-line/60 overflow-hidden">
        {items.length === 0 && <EmptyState icon={<CalendarClock />} title={t('up.empty')} text={t('up.emptyHint')} />}
        {items.map((it) => {
          const r = resolve(it.entry, it.type)
          const days = diffDays(it.from, it.to) + 1
          const dayLabel = diffDays(today, it.from) === 1 ? t('common.tomorrow') : fmtDate(it.from, lang, { weekday: 'long' })
          const detail = it.type.kind === 'work' && r.startMin != null && r.endMin != null
            ? `${fmtHM(r.startMin)} – ${fmtHM(r.endMin)}`
            : days > 1
              ? `${fmtDate(it.from, lang, { day: 'numeric', month: 'short' })} – ${fmtDate(it.to, lang, { day: 'numeric', month: 'short' })} · ${t('common.days', { n: days })}`
              : it.type.name
          return (
            <button
              key={it.from}
              type="button"
              onClick={() => openEditor(it.from)}
              className="flex w-full items-center gap-3.5 px-4 py-3 text-left transition active:bg-field"
            >
              <div className="w-10 shrink-0 text-center">
                <p className="text-[10.5px] font-semibold uppercase text-muted">{fmtDate(it.from, lang, { month: 'short' })}</p>
                <p className="text-[19px] font-semibold leading-tight tabular-nums">{parseKey(it.from).d}</p>
              </div>
              <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: it.type.color }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{it.type.kind === 'work' ? it.type.name : dayLabel}</p>
                <p className="truncate text-[13px] text-muted">{it.type.kind === 'work' ? `${dayLabel} · ${detail}` : detail}</p>
              </div>
              <ShiftChip type={it.type} size="sm" />
            </button>
          )
        })}
      </Card>
    </section>
  )
}
