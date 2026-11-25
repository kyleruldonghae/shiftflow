import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, TreePalm } from 'lucide-react'
import { addDays, daysInMonth, fmtDate, monthNames, parseKey, toKey } from '@/domain/time'
import { blocksOfKind, countKind } from '@/domain/holidays'
import { useEntries, useNow, useShiftTypes } from '@/data/hooks'
import { useI18n } from '@/i18n'
import { useApp, useAppSettings } from '@/app/context'
import { cn } from '@/lib/utils'
import { IconButton } from '@/ui/Button'
import { Card, EmptyState, SectionTitle } from '@/ui/Card'

/** Phase 1: vacation balance and periods from marked days. Requests/statuses come in Phase 2. */
export function HolidaysScreen() {
  const { t, lang } = useI18n()
  const now = useNow(60_000)
  const settings = useAppSettings()
  const { map: types } = useShiftTypes()
  const { openEditor } = useApp()
  const [year, setYear] = useState(parseKey(now.key).y)
  const { entries } = useEntries(`${year}-01-01`, `${year}-12-31`)

  const today = now.key
  const taken = countKind(entries, types, 'vacation', undefined, today)
  const planned = countKind(entries, types, 'vacation', addDays(today, 1))
  const remaining = settings.vacationDaysPerYear - taken - planned
  const ph = countKind(entries, types, 'publicHoliday')
  const blocks = blocksOfKind(entries, types, 'vacation')
  const vacationDays = new Set(entries.filter((e) => types.get(e.shiftTypeId)?.kind === 'vacation').map((e) => e.date))
  const pct = (n: number) => `${Math.min(100, (n / Math.max(1, settings.vacationDaysPerYear)) * 100)}%`
  const vacationColor = [...types.values()].find((ty) => ty.kind === 'vacation')?.color ?? '#F0D98C'

  return (
    <div className="space-y-5">
      <header className="flex items-center px-1 pt-2">
        <h1 className="text-[28px] font-semibold tracking-tight">{t('nav.holidays')}</h1>
        <div className="ml-auto flex items-center">
          <IconButton aria-label={t('common.prev')} onClick={() => setYear((y) => y - 1)}><ChevronLeft /></IconButton>
          <span className="w-12 text-center text-[15px] font-semibold tabular-nums">{year}</span>
          <IconButton aria-label={t('common.next')} onClick={() => setYear((y) => y + 1)}><ChevronRight /></IconButton>
        </div>
      </header>

      <Card className="p-5">
        <div className="flex items-baseline justify-between">
          <p className="text-[15px] font-semibold">{t('hol.vacation')}</p>
          <p className="text-[13px] text-muted">{t('hol.entitlement')}: {t('common.days', { n: settings.vacationDaysPerYear })}</p>
        </div>
        <p className="mt-2 text-[40px] font-semibold leading-none tracking-tight tabular-nums">
          {remaining}
          <span className="ml-1.5 text-[15px] font-medium text-muted">{t('hol.remaining').toLowerCase()}</span>
        </p>
        <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-field">
          <motion.span className="h-full" style={{ background: vacationColor }} initial={{ width: 0 }} animate={{ width: pct(taken) }} transition={{ duration: 0.6 }} />
          <motion.span className="h-full opacity-50" style={{ background: vacationColor }} initial={{ width: 0 }} animate={{ width: pct(planned) }} transition={{ duration: 0.6, delay: 0.1 }} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Num label={t('hol.taken')} n={taken} />
          <Num label={t('hol.planned')} n={planned} />
          <Num label={t('hol.remaining')} n={remaining} />
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3 text-[13px]">
          <span className="font-medium">{t('hol.publicHolidays')}</span>
          <span className="text-muted">{t('hol.marked', { n: ph, total: settings.publicHolidaysPerYear })}</span>
        </div>
        <p className="mt-3 text-[11.5px] leading-relaxed text-muted">{t('hol.method')}</p>
      </Card>

      <section>
        <SectionTitle>{t('hol.timeline')}</SectionTitle>
        <Card className="space-y-1.5 p-4">
          {monthNames(lang, 'short').map((name, i) => (
            <div key={name} className="flex items-center gap-2">
              <span className="w-9 text-[11px] font-semibold uppercase text-muted">{name}</span>
              <div className="grid flex-1 grid-cols-[repeat(31,minmax(0,1fr))] gap-[2px]">
                {Array.from({ length: daysInMonth(year, i + 1) }, (_, d) => {
                  const key = toKey(year, i + 1, d + 1)
                  const on = vacationDays.has(key)
                  return (
                    <span
                      key={key}
                      className={cn('h-3 rounded-[2px]', !on && 'bg-field', key === today && 'ring-1 ring-accent')}
                      style={on ? { background: vacationColor } : undefined}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </Card>
      </section>

      <section>
        <SectionTitle>{t('hol.periods')}</SectionTitle>
        <Card className="divide-y divide-line/60 overflow-hidden">
          {blocks.length === 0 && <EmptyState icon={<TreePalm />} title={t('hol.none', { year })} />}
          {blocks.map((b) => {
            const status = b.to < today ? t('hol.completed') : b.from > today ? t('hol.upcoming') : t('hol.ongoing')
            return (
              <button key={b.from} type="button" onClick={() => openEditor(b.from)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-field">
                <span className="h-9 w-1 rounded-full" style={{ background: types.get(b.typeId)?.color }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">
                    {fmtDate(b.from, lang, { day: 'numeric', month: 'short' })}
                    {b.days > 1 && ` – ${fmtDate(b.to, lang, { day: 'numeric', month: 'short' })}`}
                  </p>
                  <p className="text-[13px] text-muted">{b.days === 1 ? t('common.day') : t('common.days', { n: b.days })}</p>
                </div>
                <span className={cn('rounded-full px-2.5 py-1 text-[11.5px] font-semibold', b.to < today ? 'bg-field text-muted' : 'bg-accent/15 text-accent')}>
                  {status}
                </span>
              </button>
            )
          })}
        </Card>
      </section>
    </div>
  )
}

function Num({ label, n }: { label: string; n: number }) {
  return (
    <div>
      <p className="text-[19px] font-semibold tabular-nums">{n}</p>
      <p className="text-[11.5px] text-muted">{label}</p>
    </div>
  )
}
