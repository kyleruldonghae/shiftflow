import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg shadow-elev',
  secondary: 'bg-field text-fg',
  ghost: 'text-fg hover:bg-field',
  danger: 'bg-danger/12 text-danger',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 rounded-xl px-3 text-[13px]',
  md: 'h-11 rounded-2xl px-4 text-[15px]',
  lg: 'h-13 rounded-2xl px-5 text-base',
}

export function Button({
  variant = 'primary', size = 'md', block, className, type = 'button', ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; block?: boolean }) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 font-semibold transition-[transform,background-color,opacity] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-[18px] [&_svg]:shrink-0',
        variants[variant], sizes[size], block && 'w-full', className,
      )}
      {...props}
    />
  )
}

export function IconButton({ className, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-full text-fg transition active:scale-95 hover:bg-field disabled:opacity-30 disabled:pointer-events-none [&_svg]:size-5',
        className,
      )}
      {...props}
    />
  )
}
