import { createContext, useContext } from 'react'
import type { DateKey, Settings } from '@/domain/types'

/** Settings loaded once by the app shell; always defined inside the app. */
export const SettingsContext = createContext<Settings | null>(null)

export function useAppSettings() {
  const s = useContext(SettingsContext)
  if (!s) throw new Error('useAppSettings outside SettingsContext')
  return s
}

export type Tab = 'home' | 'calendar' | 'stats' | 'holidays' | 'settings'
export const TABS: Tab[] = ['home', 'calendar', 'stats', 'holidays', 'settings']

export interface AppApi {
  /** Opens the shift editor sheet for a day. */
  openEditor: (date: DateKey) => void
  goTo: (tab: Tab) => void
  /** Day last focused in the calendar, used by the add button. */
  focusDate: DateKey | null
  setFocusDate: (d: DateKey | null) => void
}

export const AppContext = createContext<AppApi | null>(null)

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp outside AppContext')
  return ctx
}
