import type { ShiftType } from '@/domain/types'
import { cn } from '@/lib/utils'

/** The coloured shift-code pill. Pastel colours always use dark ink for contrast. */
export function ShiftChip({ type, size = 'md', className }: { type?: ShiftType; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string }) {
  if (!type) return null
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-bold tabular-nums text-ink',
        size === 'xs' && 'h-[18px] min-w-6 rounded-md px-1 text-[10px]',
        size === 'sm' && 'h-5 min-w-7 rounded-md px-1.5 text-[11px]',
        size === 'md' && 'h-6 min-w-9 px-2 text-xs',
        size === 'lg' && 'h-8 min-w-11 px-2.5 text-sm',
        className,
      )}
      style={{ background: type.color }}
    >
      {type.code}
    </span>
  )
}

/** Grid of shift types for one-tap picking. */
export function TypeGrid({ types, selectedId, onPick }: { types: ShiftType[]; selectedId?: string; onPick: (id: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {types.map((t) => {
        const active = t.id === selectedId
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t.id)}
            aria-pressed={active}
            className={cn(
              'flex min-h-[66px] flex-col items-start justify-between rounded-2xl border-2 p-2.5 text-left transition active:scale-[0.97]',
              active ? 'border-accent bg-accent/10' : 'border-transparent bg-field',
            )}
          >
            <ShiftChip type={t} size="sm" />
            <span className="mt-1.5 line-clamp-2 text-[12px] font-medium leading-tight">{t.name}</span>
          </button>
        )
      })}
    </div>
  )
}
