import { useMemo, useRef, useState } from 'react'
import { FileUp } from 'lucide-react'
import type { DateKey } from '@/domain/types'
import { fmtDate } from '@/domain/time'
import { db } from '@/data/db'
import { useShiftTypes } from '@/data/hooks'
import { commit, uid } from '@/data/repo'
import {
  ImportError, buildPreview, parseRoster, toUpdates, type ParsedRoster, type PreviewItem, type PreviewStatus,
} from '@/services/import/rosterImport'
import { useI18n } from '@/i18n'
import { useAppSettings } from '@/app/context'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/Button'
import { Textarea } from '@/ui/Field'
import { Sheet } from '@/ui/Sheet'
import { ShiftChip } from '@/ui/ShiftChip'
import { useToast } from '@/ui/Toast'

const statusStyle: Record<PreviewStatus, string> = {
  new: 'bg-accent/15 text-accent',
  same: 'bg-field text-muted',
  conflict: 'bg-[#F2C49E]/35 text-[#9A5B1F] dark:text-[#F2C49E]',
  unknown: 'bg-danger/15 text-danger',
  ignored: 'bg-field text-muted',
}

/** Upload → read my row → preview with statuses → explicit choices → confirm. */
export function ImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const settings = useAppSettings()
  const { list: types, map: typeMap, active } = useShiftTypes()
  const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<ParsedRoster | null>(null)
  const [preview, setPreview] = useState<PreviewItem[] | null>(null)
  const [error, setError] = useState('')
  const [replace, setReplace] = useState<Set<DateKey>>(new Set())
  const [assign, setAssign] = useState<Record<DateKey, string>>({})

  const reset = () => {
    setText('')
    setFileName('')
    setParsed(null)
    setPreview(null)
    setError('')
    setReplace(new Set())
    setAssign({})
  }
  const close = () => {
    reset()
    onClose()
  }

  const read = async (content: string, person?: string) => {
    setError('')
    try {
      const p = parseRoster(content, person)
      setParsed(p)
      if (!p.items.length) {
        if (!p.people.length || p.person) setError(t('import.error', { msg: 'empty' }))
        setPreview(null)
        return
      }
      const dates = p.items.map((i) => i.date).sort()
      const existing = await db.entries.where('date').between(dates[0], dates[dates.length - 1], true, true).toArray()
      setPreview(buildPreview(p.items, types, settings?.importIgnore ?? [], new Map(existing.map((e) => [e.date, e]))))
    } catch (e) {
      setError(t('import.error', { msg: e instanceof ImportError ? e.message : String(e) }))
    }
  }

  const counts = useMemo(() => {
    const c: Record<PreviewStatus, number> = { new: 0, same: 0, conflict: 0, unknown: 0, ignored: 0 }
    preview?.forEach((p) => c[p.status]++)
    return c
  }, [preview])

  const updates = preview ? toUpdates(preview, { replace, assign }, 'preview') : []

  const confirmImport = async () => {
    if (!preview || !updates.length) return
    const id = uid()
    const real = toUpdates(preview, { replace, assign }, id)
    const label = t('import.label', { file: fileName || 'roster' })
    try {
      await commit(label, 'import', real, { id, importMeta: { source: fileName || 'pasted', count: real.length } })
      toast({ text: t('import.done', { n: real.length }) })
      close()
    } catch {
      toast({ text: t('error.save'), tone: 'error' })
    }
  }

  const byMonth = useMemo(() => {
    const g = new Map<string, PreviewItem[]>()
    preview?.forEach((p) => {
      const k = p.date.slice(0, 7)
      g.set(k, [...(g.get(k) ?? []), p])
    })
    return [...g.entries()]
  }, [preview])

  return (
    <Sheet
      open={open}
      onClose={close}
      title={t('import.title')}
      closeLabel={t('common.close')}
      footer={
        preview ? (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={reset}>{t('common.back')}</Button>
            <Button block disabled={!updates.length} onClick={confirmImport}>
              {updates.length ? t('import.confirm', { n: updates.length }) : t('import.nothing')}
            </Button>
          </div>
        ) : undefined
      }
    >
      {!preview && (
        <div className="space-y-4">
          <p className="text-[13px] leading-relaxed text-muted">{t('import.supported')}</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json,.txt,text/csv,application/json,text/plain"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              setFileName(f.name)
              const content = await f.text()
              setText(content)
              await read(content)
            }}
          />
          <Button block size="lg" onClick={() => fileRef.current?.click()}>
            <FileUp /> {t('import.chooseFile')}
          </Button>
          <p className="text-center text-[12px] text-muted">{t('import.orPaste')}</p>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'date,code\n2026-12-01,AFR\n2026-12-02,14'}
            className="min-h-28 font-mono text-[13px]"
          />
          <Button variant="secondary" block disabled={!text.trim()} onClick={() => { setFileName(''); void read(text) }}>
            {t('import.read')}
          </Button>
          {error && <p className="text-[13px] font-medium text-danger">{error}</p>}
          {parsed && !parsed.person && parsed.people.length > 1 && (
            <div>
              <p className="mb-2 text-[13px] font-semibold">{t('import.whichRow')}</p>
              <div className="grid gap-1.5">
                {parsed.people.map((p) => (
                  <Button key={p} variant="secondary" className="justify-start" onClick={() => read(text, p)}>{p}</Button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {preview && parsed && (
        <div className="space-y-4">
          <div className="space-y-1 text-[13px] text-muted">
            {parsed.person && <p>{t('import.person', { name: parsed.person })}</p>}
            <p>{t('import.months', { list: parsed.months.map((m) => fmtDate(`${m}-01`, lang, { month: 'long', year: 'numeric' })).join(', ') })}</p>
            {parsed.skippedLines > 0 && <p className="text-danger">{t('import.skipped', { n: parsed.skippedLines })}</p>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(counts) as PreviewStatus[]).filter((s) => counts[s]).map((s) => (
              <span key={s} className={cn('rounded-full px-2.5 py-1 text-[12px] font-semibold', statusStyle[s])}>
                {t(`import.status.${s}`)} · {counts[s]}
              </span>
            ))}
          </div>
          {counts.conflict > 0 && <p className="text-[12px] text-muted">{t('import.conflictHint')}</p>}
          {counts.unknown > 0 && <p className="text-[12px] text-muted">{t('import.unknownHint')}</p>}

          {byMonth.map(([month, items]) => (
            <section key={month}>
              <h3 className="mb-1.5 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">
                {fmtDate(`${month}-01`, lang, { month: 'long', year: 'numeric' })}
              </h3>
              <div className="divide-y divide-line/60 overflow-hidden rounded-2xl bg-field/60">
                {items.map((p) => {
                  const type = p.typeId ? typeMap.get(p.typeId) : undefined
                  const existingType = p.existing ? typeMap.get(p.existing.shiftTypeId) : undefined
                  return (
                    <div key={p.date} className="flex items-center gap-2.5 px-3 py-2">
                      <span className="w-[72px] shrink-0 text-[13px] font-medium tabular-nums">
                        {fmtDate(p.date, lang, { weekday: 'short', day: 'numeric' })}
                      </span>
                      <span className="w-10 shrink-0 font-mono text-[12px] text-muted">{p.code}</span>
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        {p.status === 'conflict' && existingType && (
                          <>
                            <ShiftChip type={existingType} size="xs" className={cn(replace.has(p.date) && 'line-through opacity-50')} />
                            <span className="text-muted">→</span>
                          </>
                        )}
                        {type && <ShiftChip type={type} size="xs" className={cn(p.status === 'conflict' && !replace.has(p.date) && 'opacity-40')} />}
                        {p.status === 'unknown' && (
                          <select
                            value={assign[p.date] ?? ''}
                            onChange={(e) => setAssign((a) => ({ ...a, [p.date]: e.target.value }))}
                            className="h-8 min-w-0 rounded-lg bg-card px-2 text-[12px]"
                          >
                            <option value="">{t('import.skip')}</option>
                            {active.map((ty) => <option key={ty.id} value={ty.id}>{ty.code} · {ty.name}</option>)}
                          </select>
                        )}
                      </div>
                      {p.status === 'conflict' ? (
                        <button
                          type="button"
                          onClick={() => setReplace((r) => { const n = new Set(r); if (n.has(p.date)) n.delete(p.date); else n.add(p.date); return n })}
                          className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold', replace.has(p.date) ? 'bg-accent text-accent-fg' : statusStyle.conflict)}
                        >
                          {replace.has(p.date) ? t('import.replace') : t('import.keep')}
                        </button>
                      ) : (
                        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', statusStyle[p.status])}>
                          {t(`import.status.${p.status}`)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </Sheet>
  )
}
