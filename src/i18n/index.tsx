import { createContext, useCallback, useContext, type ReactNode } from 'react'
import type { Lang } from '@/domain/types'
import { en, type Key } from './en'
import { de } from './de'

const dicts: Record<Lang, Record<Key, string>> = { en, de }
const LangContext = createContext<Lang>('en')

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>
}

export type TFn = (key: Key, vars?: Record<string, string | number>) => string

export function useI18n() {
  const lang = useContext(LangContext)
  const t = useCallback<TFn>(
    (key, vars) => {
      let s = dicts[lang][key] ?? en[key]
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
      return s
    },
    [lang],
  )
  return { t, lang }
}

export type { Key }
