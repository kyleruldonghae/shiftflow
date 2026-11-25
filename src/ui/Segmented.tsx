import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/** iOS-style segmented control with a sliding selection. */
export function Segmented<T extends string>({
  value, onChange, options, id, className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  id: string
  className?: string
}) {
  return (
    <div role="tablist" className={cn('relative flex rounded-[14px] bg-field p-1', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className="relative h-8 flex-1 rounded-[10px] text-[13px] font-semibold"
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[10px] bg-card shadow-elev"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className={cn('relative transition-colors', active ? 'text-fg' : 'text-muted')}>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
