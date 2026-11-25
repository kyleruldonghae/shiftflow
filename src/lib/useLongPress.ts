import { useRef } from 'react'
import type React from 'react'

/** Tap and long-press (or right-click) on the same element without the two firing together. */
export function useLongPress(onLongPress: () => void, onTap: () => void, ms = 450) {
  const timer = useRef<number | undefined>(undefined)
  const fired = useRef(false)
  const origin = useRef<{ x: number; y: number } | null>(null)

  const clear = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = undefined
  }

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return
      fired.current = false
      origin.current = { x: e.clientX, y: e.clientY }
      clear()
      timer.current = window.setTimeout(() => {
        fired.current = true
        navigator.vibrate?.(8)
        onLongPress()
      }, ms)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (origin.current && Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) > 8) clear()
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onClick: () => {
      if (fired.current) {
        fired.current = false
        return
      }
      onTap()
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault()
      if (!fired.current) {
        clear()
        fired.current = true
        onLongPress()
      }
    },
  }
}
