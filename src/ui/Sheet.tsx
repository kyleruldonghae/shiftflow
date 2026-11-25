import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import { X } from 'lucide-react'
import { IconButton } from './Button'

/** Native-style bottom sheet: drag the handle down or tap outside to close. */
export function Sheet({
  open, onClose, title, children, footer, closeLabel = 'Close',
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  closeLabel?: string
}) {
  const controls = useDragControls()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[92dvh] w-full max-w-[640px] flex-col rounded-t-[28px] bg-sheet shadow-[0_-10px_40px_rgb(0_0_0/0.25)]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 36, stiffness: 400 }}
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose()
            }}
          >
            <div className="touch-none cursor-grab pt-2.5" onPointerDown={(e) => controls.start(e)}>
              <div className="mx-auto h-1.5 w-10 rounded-full bg-line" />
              {title && (
                <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-2">
                  <h2 className="min-w-0 truncate text-[17px] font-semibold">{title}</h2>
                  <IconButton onClick={onClose} aria-label={closeLabel} className="-mr-2 bg-field">
                    <X />
                  </IconButton>
                </div>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-2">{children}</div>
            {footer ? (
              <div className="border-t border-line/60 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+14px)]">{footer}</div>
            ) : (
              <div className="pb-[env(safe-area-inset-bottom)]" />
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
