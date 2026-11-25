import { useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ChartNoAxesColumn } from 'lucide-react'
import { addMonths, fmtDuration, monthRange, parseKey } from '@/domain/time'
import { summarize } from '@/domain/shiftCalc'
import { useEntries, useNow, useShiftTypes } from '@/data/hooks'
import { useI18n } from '@/i18n'
import { Card, EmptyState, SectionTitle } from '@/ui/Card'
import { Segmented } from '@/ui/Segmented'
import { ShiftChip } from '@/ui/ShiftChip'

type Period = 'month' | 'last' | 'year'

/** Phase 1: real numbers from your data. Charts and overtime come in Phase 2. */
export function StatisticsScreen() {
  const { t, lang } = useI18n()
  const now = useNow(60_000)
  const { list, map: types } = useShiftTypes()
  const [period, setPeriod] = useState<Period>('month')
  const { y, m } = parseKey(now.key)
  const prev = addMonths(y, m, -1)
  const [from, to] =
    period === 'month' ? monthRange(y, m) : period === 'last' ? monthRange(prev.y, prev.m) : [`${y}-01-01`, `${y}-12-31`]
  const { entries, ready } = useEntries(from, to)
  const s = summarize(entries, types)
  const usedTypes = list.filter((ty) => s.byType[ty.id])
  const maxCount = Math.max(1, ...usedTypes.map((ty) => s.byType[ty.id]))
  const bandTotal = s.early + s.mid + s.late

  return (
    <div className="space-y-5">
      <header className="px-1 pt-2">
        <h1 className="text-[28px] font-semibold tracking-tight">{t('nav.stats')}</h1>
      </header>
      <Segmented
        id="period"
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'month', label: t('stats.thisMonth') },
          { value: 'last', label: t('stats.lastMonth') },
          { value: 'year', label: t('stats.thisYear') },
        ]}
      />

      {ready && entries.length === 0 ? (
        <Card><EmptyState icon={<ChartNoAxesColumn />} title={t('stats.empty')} /></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Tile label={t('stats.planned')} value={fmtDuration(s.grossMin, lang)} sub={t('stats.plannedSub')} />
            <Tile label={t('stats.net')} value={s.netMin != null ? fmtDuration(s.netMin, lang) : '–'} sub={s.netMin == null ? t('stats.netMissing') : undefined} />
            <Tile label={t('stats.workDays')} value={String(s.workDays)} />
            <Tile label={t('stats.offDays')} value={String(s.offDays + s.vacationDays + s.publicHolidayDays)} />
            <Tile label={t('stats.weekend')} value={String(s.weekendWorkDays)} />
            <Tile label={t('stats.streak')} value={String(s.longestStreak)} sub={t('stats.streakSub')} />
          </div>

          {bandTotal > 0 && (
            <section>
              <SectionTitle>{t('stats.bands')}</SectionTitle>
              <Card className="p-4">
                <div className="flex h-3.5 overflow-hidden rounded-full bg-field">
                  {[
                    { n: s.early, color: '#B8D8C0' },
                    { n: s.mid, color: '#B8D5EF' },
                    { n: s.late, color: '#F2C49E' },
                  ].map((b, i) => (
                    <motion.span
                      key={i}
                      initial={{ width: 0 }}
                      animate={{ width: `${(b.n / bandTotal) * 100}%` }}
                      transition={{ duration: 0.6, delay: i * 0.08 }}
                      style={{ background: b.color }}
                    />
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-3 text-center text-[12.5px]">
                  <Legend color="#B8D8C0" label={t('stats.early')} n={s.early} />
                  <Legend color="#B8D5EF" label={t('stats.mid')} n={s.mid} />
                  <Legend color="#F2C49E" label={t('stats.late')} n={s.late} />
                </div>
              </Card>
            </section>
          )}

          <section>
            <SectionTitle>{t('stats.mix')}</SectionTitle>
            <Card className="space-y-3 p-4">
              {usedTypes.map((ty) => (
                <div key={ty.id} className="flex items-center gap-3">
                  <ShiftChip type={ty} size="sm" className="w-11" />
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-field">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: ty.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(s.byType[ty.id] / maxCount) * 100}%` }}
                      transition={{ duration: 0.6 }}
                    />
                  </div>
                  <span className="w-7 text-right text-[13px] font-semibold tabular-nums">{s.byType[ty.id]}</span>
                </div>
              ))}
            </Card>
          </section>
        </>
      )}
      <p className="px-1 text-center text-[12px] text-muted">{t('stats.more')}</p>
    </div>
  )
}

function Tile({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[12px] font-medium text-muted">{label}</p>
      <p className="mt-0.5 text-[22px] font-semibold tracking-tight tabular-nums">{value}</p>
      {sub && <p className="text-[11.5px] text-muted">{sub}</p>}
    </Card>
  )
}

function Legend({ color, label, n }: { color: string; label: string; n: number }) {
  return (
    <span className="inline-flex items-center justify-center gap-1.5">
      <span className="size-2.5 rounded-full" style={{ background: color }} />
      {label} <b className="tabular-nums">{n}</b>
    </span>
  )
}
