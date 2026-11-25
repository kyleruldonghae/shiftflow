import type { DateKey, ShiftType } from '@/domain/types'
import { addDays, fmtHM, parseKey, weekdayNames } from '@/domain/time'
import { crossesMidnight, resolve } from '@/domain/shiftCalc'
import { useEntries } from '@/data/hooks'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { ShiftChip } from '@/ui/ShiftChip'

/** Seven rows on a 24-hour track, so early/late and overnight shifts are visible at a glance. */
export function WeekView({ weekStart, today, types, onTap }: {
  weekStart: DateKey; today: DateKey; types: Map<string, ShiftType>; onTap: (d: DateKey) => void
}) {
  const { t, lang } = useI18n()
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  // One day before, for night shifts continuing into Monday
  const { map } = useEntries(addDays(weekStart, -1), days[6])
  const names = weekdayNames(lang, 'short')

  return (
    <div>
      <div className="mb-1 ml-[60px] flex justify-between pr-1 text-[10px] font-medium tabular-nums text-muted">
        {[0, 6, 12, 18, 24].map((h) => <span key={h}>{String(h).padStart(2, '0')}</span>)}
      </div>
      <div className="space-y-1.5">
        {days.map((d, i) => {
          const e = map.get(d)
          const type = e ? types.get(e.shiftTypeId) : undefined
          const r = e && type ? resolve(e, type) : undefined
          const prev = map.get(addDays(d, -1))
          const prevType = prev ? types.get(prev.shiftTypeId) : undefined
          const prevR = prev && prevType ? resolve(prev, prevType) : undefined
          const carry = prevR?.isWork && prevR.startMin != null && prevR.endMin != null && crossesMidnight(prevR.startMin, prevR.endMin)
            ? prevR : undefined
          const isToday = d === today
          return (
            <button
              key={d}
              type="button"
              onClick={() => onTap(d)}
              className={cn(
                'flex w-full items-center gap-2 rounded-2xl p-1.5 text-left transition active:scale-[0.99]',
                isToday ? 'bg-accent/12' : 'hover:bg-field',
              )}
            >
              <div className="w-[50px] shrink-0 text-center">
                <p className={cn('text-[11px] font-semibold uppercase', isToday ? 'text-accent' : 'text-muted')}>{names[i]}</p>
                <p className="text-[17px] font-semibold leading-tight tabular-nums">{parseKey(d).d}</p>
              </div>
              <div className="relative h-11 flex-1 overflow-hidden rounded-xl bg-field">
                {[25, 50, 75].map((p) => (
                  <span key={p} className="absolute inset-y-0 w-px bg-line/70" style={{ left: `${p}%` }} />
                ))}
                {carry && (
                  <span
                    className="absolute inset-y-1.5 left-0 rounded-r-lg opacity-60"
                    style={{ width: `${(carry.endMin! / 1440) * 100}%`, background: carry.type.color }}
                    title={t('cal.fromPrev')}
                  />
                )}
                {r && type && (r.isWork && r.startMin != null && r.endMin != null ? (
                  <span
                    className="absolute inset-y-1.5 flex items-center gap-1.5 overflow-hidden rounded-lg px-2 text-[11px] font-bold text-ink"
                    style={{
                      left: `${(r.startMin / 1440) * 100}%`,
                      width: `${((crossesMidnight(r.startMin, r.endMin) ? 1440 - r.startMin : r.endMin - r.startMin) / 1440) * 100}%`,
                      background: type.color,
                    }}
                  >
                    <span>{type.code}</span>
                    <span className="truncate font-semibold opacity-70">{fmtHM(r.startMin)}–{fmtHM(r.endMin)}</span>
                  </span>
                ) : (
                  <span
                    className="absolute inset-1.5 flex items-center gap-2 rounded-lg px-2 text-[12px] font-semibold text-ink"
                    style={{ background: type.color }}
                  >
                    <ShiftChip type={type} size="xs" className="bg-white/50" />
                    <span className="truncate">{type.name}</span>
                  </span>
                ))}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
