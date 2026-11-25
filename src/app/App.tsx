import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, ChartNoAxesColumn, House, Plus, Settings as SettingsIcon, TreePalm } from 'lucide-react'
import type { DateKey, Theme } from '@/domain/types'
import { zonedNow } from '@/domain/time'
import { useSettings, useShiftTypes } from '@/data/hooks'
import { I18nProvider, useI18n } from '@/i18n'
import { ToastProvider } from '@/ui/Toast'
import { cn } from '@/lib/utils'
import { AppContext, SettingsContext, TABS, type Tab } from './context'
import { HomeScreen } from '@/features/home/HomeScreen'
import { CalendarScreen } from '@/features/calendar/CalendarScreen'
import { ShiftEditorSheet } from '@/features/calendar/ShiftEditorSheet'
import { StatisticsScreen } from '@/features/statistics/StatisticsScreen'
import { HolidaysScreen } from '@/features/holidays/HolidaysScreen'
import { SettingsScreen } from '@/features/settings/SettingsScreen'

function readHash(): Tab {
  const h = window.location.hash.slice(1) as Tab
  return TABS.includes(h) ? h : 'home'
}

function useTheme(theme: Theme | undefined) {
  useEffect(() => {
    if (!theme) return
    try {
      localStorage.setItem('sf-theme', theme)
    } catch {
      /* private mode */
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches)
      document.documentElement.classList.toggle('dark', dark)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#101B24' : '#F7F8F4')
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}

export function App() {
  const settings = useSettings()
  const types = useShiftTypes()
  useTheme(settings?.theme)

  const [tab, setTab] = useState<Tab>(readHash)
  const [editDate, setEditDate] = useState<DateKey | null>(null)
  const [focusDate, setFocusDate] = useState<DateKey | null>(null)

  useEffect(() => {
    const onHash = () => setTab(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const api = useMemo(
    () => ({
      openEditor: setEditDate,
      goTo: (t: Tab) => {
        if (window.location.hash.slice(1) !== t) window.location.hash = t
        setTab(t)
        window.scrollTo({ top: 0 })
      },
      focusDate,
      setFocusDate,
    }),
    [focusDate],
  )

  if (!settings || !types.ready) return <Splash />

  return (
    <I18nProvider lang={settings.language}>
      <ToastProvider>
        <SettingsContext.Provider value={settings}>
        <AppContext.Provider value={api}>
          <main className="mx-auto w-full max-w-[640px] px-4 pt-[calc(env(safe-area-inset-top)+14px)] pb-[calc(env(safe-area-inset-bottom)+120px)]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                {tab === 'home' && <HomeScreen />}
                {tab === 'calendar' && <CalendarScreen />}
                {tab === 'stats' && <StatisticsScreen />}
                {tab === 'holidays' && <HolidaysScreen />}
                {tab === 'settings' && <SettingsScreen />}
              </motion.div>
            </AnimatePresence>
          </main>
          {(tab === 'home' || tab === 'calendar') && (
            <AddButton onClick={() => setEditDate(tab === 'calendar' && focusDate ? focusDate : zonedNow().key)} />
          )}
          <BottomNav tab={tab} onChange={api.goTo} />
          <ShiftEditorSheet date={editDate} onClose={() => setEditDate(null)} />
        </AppContext.Provider>
        </SettingsContext.Provider>
      </ToastProvider>
    </I18nProvider>
  )
}

function AddButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n()
  return (
    <motion.button
      type="button"
      aria-label={t('nav.add')}
      onClick={onClick}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileTap={{ scale: 0.92 }}
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+86px)] right-[max(20px,calc(50vw-300px))] z-40 grid size-14 place-items-center rounded-full bg-accent text-accent-fg shadow-[0_10px_28px_rgb(0_0_0/0.22)]"
    >
      <Plus className="size-6" strokeWidth={2.4} />
    </motion.button>
  )
}

function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const { t } = useI18n()
  const items = [
    { tab: 'home' as const, icon: House, label: t('nav.home') },
    { tab: 'calendar' as const, icon: CalendarDays, label: t('nav.calendar') },
    { tab: 'stats' as const, icon: ChartNoAxesColumn, label: t('nav.stats') },
    { tab: 'holidays' as const, icon: TreePalm, label: t('nav.holidays') },
    { tab: 'settings' as const, icon: SettingsIcon, label: t('nav.settings') },
  ]
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[640px]">
        {items.map(({ tab: id, icon: Icon, label }) => {
          const active = id === tab
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={active ? 'page' : undefined}
              className="relative flex h-[62px] flex-1 flex-col items-center justify-center gap-1"
            >
              {active && (
                <motion.span layoutId="nav-dot" className="absolute top-0 h-[3px] w-7 rounded-b-full bg-accent" />
              )}
              <Icon className={cn('size-[22px] transition-colors', active ? 'text-accent' : 'text-muted')} strokeWidth={active ? 2.2 : 1.8} />
              <span className={cn('text-[10.5px] font-medium transition-colors', active ? 'text-fg' : 'text-muted')}>{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <motion.img
        src="icon.svg"
        alt="ShiftFlow"
        className="size-16 rounded-[18px]"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15 }}
      />
    </div>
  )
}
