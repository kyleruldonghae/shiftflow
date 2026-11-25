import { useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { DateKey, ShiftEntry, ShiftType } from '@/domain/types'
import { parseKey, weekdayNames } from '@/domain/time'
import { useI18n } from '@/i18n'
import { useLongPress } from '@/lib/useLongPress'
import { cn } from '@/lib/utils'

const variants = {
  enter: (dir: number) => ({ x: dir > 0 ? '35%' : dir < 0 ? '-35%' : 0, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? '-35%' : dir < 0 ? '35%' : 0, opacity: 0 }),
}

export function MonthGrid({
  month, dir, grid, entries, types, today, selected, onTap, onLongPress, onSwipe,
}: {
  month: { y: number; m: number }
  dir: number
  grid: DateKey[]
  entries: Map<DateKey, ShiftEntry>
  types: Map<string, ShiftType>
  today: DateKey
  selected: Set<DateKey>
  onTap: (d: DateKey) => void
  onLongPress: (d: DateKey) => void
  onSwipe: (dir: 1 | -1) => void
}) {
  const { lang } = useI18n()
  const dragging = useRef(false)
  const names = weekdayNames(lang, 'short')

  return (
    <div className="overflow-hidden">
      <div className="mb-1.5 grid grid-cols-7 text-center">
        {names.map((n, i) => (
          <span key={n} className={cn('text-[11px] font-semibold uppercase tracking-wide', i >= 5 ? 'text-fg/70' : 'text-muted')}>
            {n}
          </span>
        ))}
      </div>
      <AnimatePresence mode="popLayout" custom={dir} initial={false}>
        <motion.div
          key={`${month.y}-${month.m}`}
          custom={dir}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'spring', stiffness: 380, damping: 38 }}
          drag="x"
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.22}
          onDragStart={() => {
            dragging.current = true
          }}
          onDragEnd={(_, info) => {
            window.setTimeout(() => (dragging.current = false), 60)
            if (info.offset.x < -60 || info.velocity.x < -450) onSwipe(1)
            else if (info.offset.x > 60 || info.velocity.x > 450) onSwipe(-1)
          }}
          className="grid touch-pan-y grid-cols-7 gap-1"
        >
          {grid.map((d) => {
            const e = entries.get(d)
            return (
              <DayCell
                key={d}
                date={d}
                inMonth={parseKey(d).m === month.m}
                entry={e}
                type={e ? types.get(e.shiftTypeId) : undefined}
                isToday={d === today}
                isSelected={selected.has(d)}
                onTap={() => !dragging.current && onTap(d)}
                onLongPress={() => !dragging.current && onLongPress(d)}
              />
            )
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function DayCell({ date, inMonth, entry, type, isToday, isSelected, onTap, onLongPress }: {
  date: DateKey; inMonth: boolean; entry?: ShiftEntry; type?: ShiftType
  isToday: boolean; isSelected: boolean; onTap: () => void; onLongPress: () => void
}) {
  const press = useLongPress(onLongPress, onTap)
  const { d } = parseKey(date)
  return (
    <button
      type="button"
      {...press}
      aria-label={date}
      aria-pressed={isSelected}
      className={cn(
        'no-callout relative flex aspect-[4/5] flex-col items-center rounded-2xl pt-1.5 transition-[background-color,transform] duration-150 active:scale-95',
        !inMonth && 'opacity-35',
        isSelected ? 'bg-accent/18 ring-2 ring-accent' : 'hover:bg-field',
      )}
    >
      <span
        className={cn(
          'grid size-7 place-items-center rounded-full text-[13px] font-semibold tabular-nums',
          isToday && 'bg-accent text-accent-fg',
        )}
      >
        {d}
      </span>
      {type ? (
        <span
          className={cn(
            'mt-1 flex h-[22px] w-[86%] max-w-12 items-center justify-center rounded-[8px] text-[11px] font-bold tabular-nums text-ink',
            entry?.source === 'demo' && 'opacity-60',
          )}
          style={{ background: type.color }}
        >
          {type.code}
        </span>
      ) : (
        <span className="mt-1 h-[22px]" />
      )}
      {entry?.note && <span className="absolute bottom-1.5 size-1 rounded-full bg-muted" />}
    </button>
  )
}
