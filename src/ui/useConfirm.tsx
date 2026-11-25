import { useCallback, useRef, useState } from 'react'
import { useI18n } from '@/i18n'
import { Button } from './Button'
import { Sheet } from './Sheet'

interface ConfirmOptions {
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
}

/** Promise-based confirmation sheet: `if (await confirm({...})) …` */
export function useConfirm() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const opts = useRef<ConfirmOptions>({ title: '', message: '', confirmLabel: '' })
  const resolver = useRef<(v: boolean) => void>(() => {})

  const confirm = useCallback((o: ConfirmOptions) => {
    opts.current = o
    setOpen(true)
    return new Promise<boolean>((res) => {
      resolver.current = res
    })
  }, [])

  const close = (v: boolean) => {
    setOpen(false)
    resolver.current(v)
  }

  const element = (
    <Sheet open={open} onClose={() => close(false)} title={opts.current.title} closeLabel={t('common.close')}>
      <p className="text-[15px] leading-relaxed text-muted">{opts.current.message}</p>
      <div className="mt-6 grid gap-2">
        <Button variant={opts.current.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
          {opts.current.confirmLabel}
        </Button>
        <Button variant="secondary" onClick={() => close(false)}>
          {t('common.cancel')}
        </Button>
      </div>
    </Sheet>
  )

  return [element, confirm] as const
}
