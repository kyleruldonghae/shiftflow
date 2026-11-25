import { useState } from 'react'
import { CalendarSearch } from 'lucide-react'
import type { DateKey, ShiftEntry, ShiftType } from '@/domain/types'
import { addDays, fmtDate, fmtDuration, fmtHM, parseKey } from '@/domain/time'
import { grossMinutes, resolve } from '@/domain/shiftCalc'
import { useEntries } from '@/data/hooks'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/Button'
import { Card, EmptyState } from '@/ui/Card'
import { ShiftChip } from '@/ui/ShiftChip'

/** Chronological timeline grouped by month, starting today. */
export function AgendaView({ today, types, onTap }: { today: DateKey; types: Map<string, ShiftType>; onTap: (d: DateKey) => void }) {
  const { t, lang } = useI18n()
  const [back, setBack] = useState(0)
  const from = addDays(today, -back)
  const { entries, ready } = useEntries(from, addDays(today, 120))
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1))

  const groups: { month: string; items: ShiftEntry[] }[] = []
  for (const e of sorted) {
    const m = e.date.slice(0, 7)
    if (groups[groups.length - 1]?.month !== m) groups.push({ month: m, items: [] })
    groups[groups.length - 1].items.push(e)
  }

  return (
    <div className="space-y-5">
      <Button variant="secondary" size="sm" onClick={() => setBack((b) => b + 30)}>
        {t('cal.showEarlier')}
      </Button>
      {ready && groups.length === 0 && (
        <Card><EmptyState icon={<CalendarSearch />} title={t('cal.agendaEmpty')} /></Card>
      )}
      {groups.map((g) => (
        <section key={g.month}>
          <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">
            {fmtDate(`${g.month}-01`, lang, { month: 'long', year: 'numeric' })}
          </h3>
          <Card className="divide-y divide-line/60 overflow-hidden">
            {g.items.map((e) => {
              const type = types.get(e.shiftTypeId)
              if (!type) return null
              const r = resolve(e, type)
              const g2 = grossMinutes(r)
              const isToday = e.date === today
              const past = e.date < today
              return (
                <button
                  key={e.date}
                  type="button"
                  onClick={() => onTap(e.date)}
                  className={cn('flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-field', past && 'opacity-55', isToday && 'bg-accent/10')}
                >
                  <div className="w-9 shrink-0 text-center">
                    <p className={cn('text-[10.5px] font-semibold uppercase', isToday ? 'text-accent' : 'text-muted')}>
                      {fmtDate(e.date, lang, { weekday: 'short' })}
                    </p>
                    <p className="text-[18px] font-semibold leading-tight tabular-nums">{parseKey(e.date).d}</p>
                  </div>
                  <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: type.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{type.name}</p>
                    <p className="truncate text-[13px] text-muted">
                      {r.startMin != null && r.endMin != null ? `${fmtHM(r.startMin)} – ${fmtHM(r.endMin)}` : t(`kind.${type.kind}`)}
                      {g2 != null && ` · ${fmtDuration(g2, lang)}`}
                      {e.note && ` · ${e.note}`}
                    </p>
                  </div>
                  <ShiftChip type={type} size="sm" />
                </button>
              )
            })}
          </Card>
        </section>
      ))}
    </div>
  )
}
