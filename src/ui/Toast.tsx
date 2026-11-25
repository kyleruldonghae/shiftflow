import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ToastInput {
  text: string
  action?: { label: string; run: () => void }
  tone?: 'default' | 'error'
}
interface ToastMsg extends ToastInput {
  id: number
}

const ToastContext = createContext<(t: ToastInput) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<ToastMsg | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback((t: ToastInput) => {
    const id = Date.now()
    setMsg({ ...t, id })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMsg((m) => (m?.id === id ? null : m)), t.action ? 5000 : 2600)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+96px)] z-[60] flex justify-center px-4">
          <AnimatePresence>
            {msg && (
              <motion.div
                key={msg.id}
                role="status"
                initial={{ y: 16, opacity: 0, scale: 0.98 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 16, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                className={cn(
                  'pointer-events-auto flex max-w-[520px] items-center gap-4 rounded-2xl px-4 py-3 text-[14px] font-medium shadow-elev',
                  msg.tone === 'error' ? 'bg-danger text-white' : 'bg-fg text-bg',
                )}
              >
                <span className="min-w-0 flex-1">{msg.text}</span>
                {msg.action && (
                  <button
                    type="button"
                    className="shrink-0 font-semibold text-[var(--toast-action)]"
                    onClick={() => {
                      msg.action!.run()
                      setMsg(null)
                    }}
                  >
                    {msg.action.label}
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
