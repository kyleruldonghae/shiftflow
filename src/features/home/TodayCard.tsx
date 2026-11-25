import { motion } from 'framer-motion'
import { CalendarPlus, Clock, Coffee, Flag, HeartPulse, MapPin, Moon, StickyNote, Sun, Sunrise, Sunset, TreePalm } from 'lucide-react'
import type { Settings, ShiftEntry, ShiftKind, ShiftType } from '@/domain/types'
import { fmtDate, fmtDuration, fmtHM, type ZonedNow } from '@/domain/time'
import { resolve } from '@/domain/shiftCalc'
import { useI18n } from '@/i18n'
import { mix } from '@/lib/utils'
import { Button } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { useApp } from '@/app/context'
import type { TodayState } from './todayState'

const offIcons: Record<Exclude<ShiftKind, 'work'>, typeof Coffee> = {
  off: Coffee, vacation: TreePalm, sick: HeartPulse, publicHoliday: Flag,
}

function timeIcon(startMin?: number) {
  if (startMin == null) return Sun
  if (startMin < 540) return Sunrise
  if (startMin < 780) return Sun
  if (startMin < 1200) return Sunset
  return Moon
}

export function TodayCard({ state, now, nextWork, types, settings }: {
  state: TodayState; now: ZonedNow; nextWork?: ShiftEntry; types: Map<string, ShiftType>; settings: Settings
}) {
  const { t, lang } = useI18n()
  const { openEditor } = useApp()

  if (state.kind === 'none') {
    return (
      <Card className="flex flex-col items-center border-dashed px-6 py-8 text-center">
        <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-field text-muted">
          <CalendarPlus className="size-6" />
        </div>
        <p className="text-[17px] font-semibold">{t('today.noneTitle')}</p>
        <p className="mt-1 text-[14px] text-muted">{t('today.noneText')}</p>
        <Button className="mt-5" onClick={() => openEditor(now.key)}>{t('today.add')}</Button>
      </Card>
    )
  }

  const nextLine = (() => {
    if (!nextWork) return null
    const nt = types.get(nextWork.shiftTypeId)
    if (!nt) return null
    const r = resolve(nextWork, nt)
    const date = nextWork.date === now.key ? t('common.today') : fmtDate(nextWork.date, lang, { weekday: 'short', day: 'numeric', month: 'short' })
    return t('today.nextShift', { date, time: r.startMin != null ? fmtHM(r.startMin) : nt.code })
  })()

  if (state.kind === 'off') {
    const Icon = offIcons[state.type.kind as Exclude<ShiftKind, 'work'>] ?? Coffee
    const color = state.type.color
    return (
      <motion.button
        type="button"
        layout
        onClick={() => openEditor(state.entry.date)}
        className="relative block w-full overflow-hidden rounded-[26px] p-5 text-left text-ink shadow-elev"
        style={{ background: `linear-gradient(150deg, ${mix(color, '#ffffff', 0.35)} 0%, ${color} 100%)` }}
      >
        <Icon className="absolute -right-4 -top-4 size-36 opacity-[0.12]" strokeWidth={1.2} />
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-white/55 px-2 py-0.5 text-xs font-bold">{state.type.code}</span>
          {state.entry.source === 'demo' && <DemoTag />}
        </div>
        <p className="mt-4 text-[30px] font-semibold leading-tight tracking-tight">{state.type.name}</p>
        <p className="mt-1.5 max-w-[85%] text-[15px] text-ink/75">{t(`today.${state.type.kind as Exclude<ShiftKind, 'work'>}`)}</p>
        {state.entry.note && <NoteLine text={state.entry.note} />}
        {nextLine && <p className="mt-5 text-[13px] font-semibold text-ink/70">{nextLine}</p>}
      </motion.button>
    )
  }

  const { r, entry } = state
  const type = r.type
  const Icon = timeIcon(r.startMin)
  const color = type.color
  let status = ''
  let progress = 0
  if (state.kind === 'upcoming') status = t('today.startsIn', { d: fmtDuration((state.start - now.ms) / 60_000, lang) })
  if (state.kind === 'active') {
    progress = (now.ms - state.start) / (state.end - state.start)
    status = t('today.left', { d: fmtDuration((state.end - now.ms) / 60_000, lang) })
  }
  if (state.kind === 'done') status = t('today.finished', { d: fmtDuration((state.end - state.start) / 60_000, lang) })

  const breakText = r.breakMin == null
    ? t('today.breakNotSet')
    : `${t('today.break', { d: `${r.breakMin} min` })} · ${r.breakPaid ? t('today.paid') : t('today.unpaid')}`
  const location = type.location || settings.defaultLocation

  return (
    <motion.button
      type="button"
      layout
      onClick={() => openEditor(entry.date)}
      className="relative block w-full overflow-hidden rounded-[26px] p-5 text-left text-ink shadow-elev"
      style={{ background: `linear-gradient(150deg, ${mix(color, '#ffffff', 0.3)} 0%, ${color} 55%, ${mix(color, '#20332F', 0.12)} 100%)` }}
    >
      <Icon className="absolute -right-5 -top-5 size-36 opacity-[0.13]" strokeWidth={1.2} />
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-white/55 px-2 py-0.5 text-xs font-bold tabular-nums">{type.code}</span>
        <span className="text-[14px] font-semibold">{state.kind !== 'notimes' && state.fromYesterday ? t('today.fromYesterday') : type.name}</span>
        {entry.source === 'demo' && <DemoTag />}
      </div>

      {r.startMin != null && r.endMin != null ? (
        <p className="mt-4 text-[38px] font-semibold leading-none tracking-tight tabular-nums">
          {fmtHM(r.startMin)}
          <span className="mx-1.5 text-ink/40">–</span>
          {fmtHM(r.endMin)}
        </p>
      ) : (
        <p className="mt-4 text-[15px] text-ink/70">{t('today.noTimes')}</p>
      )}

      {status && <p className="mt-2 text-[16px] font-semibold text-ink/80">{status}</p>}

      {state.kind === 'active' && (
        <div className="mt-4">
          <div className="h-2.5 overflow-hidden rounded-full bg-ink/12">
            <motion.div
              className="h-full rounded-full bg-ink/70"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(2, progress * 100))}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] font-semibold tabular-nums text-ink/55">
            <span>{fmtHM(r.startMin!)}</span>
            <span>{Math.round(progress * 100)}%</span>
            <span>{fmtHM(r.endMin!)}</span>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Pill icon={<Clock />} text={breakText} />
        {location && <Pill icon={<MapPin />} text={location} />}
      </div>
      {entry.note && <NoteLine text={entry.note} />}
      {state.kind === 'done' && nextLine && <p className="mt-4 text-[13px] font-semibold text-ink/70">{nextLine}</p>}
    </motion.button>
  )
}

function Pill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/45 px-2.5 py-1 text-[12px] font-semibold text-ink/80 [&_svg]:size-3.5">
      {icon}
      {text}
    </span>
  )
}

function NoteLine({ text }: { text: string }) {
  return (
    <p className="mt-3 flex items-start gap-1.5 text-[13px] text-ink/75">
      <StickyNote className="mt-0.5 size-3.5 shrink-0" />
      <span className="line-clamp-2">{text}</span>
    </p>
  )
}

function DemoTag() {
  const { t } = useI18n()
  return <span className="rounded-md bg-ink/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{t('common.demo')}</span>
}
