import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export function Field({ label, hint, error, children, className }: {
  label: string; hint?: string; error?: string; children: ReactNode; className?: string
}) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-danger">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs leading-relaxed text-muted">{hint}</span>
      )}
    </label>
  )
}

const inputBase =
  'w-full rounded-xl border border-transparent bg-field px-3.5 text-[15px] text-fg placeholder:text-muted/80 outline-none transition focus:border-accent/60'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputBase, 'h-11', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputBase, 'min-h-20 resize-none py-2.5 leading-relaxed', className)} {...props} />
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 py-1 text-left text-[15px]"
    >
      <span>{label}</span>
      <span className={cn('relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-line')}>
        <motion.span
          className="absolute top-[3px] size-6 rounded-full bg-white shadow"
          animate={{ left: checked ? 23 : 3 }}
          transition={{ type: 'spring', stiffness: 600, damping: 35 }}
        />
      </span>
    </button>
  )
}
