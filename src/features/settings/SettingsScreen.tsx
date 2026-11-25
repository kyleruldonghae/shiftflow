import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Database, Download, FileUp, Plus, RotateCcw, Sparkles, Trash2, Upload } from 'lucide-react'
import type { Settings, ShiftType } from '@/domain/types'
import { fmtDate, fmtHM, zonedNow } from '@/domain/time'
import { db } from '@/data/db'
import { updateSettings, useChanges, useShiftTypes } from '@/data/hooks'
import { undoChange } from '@/data/repo'
import { loadDemo, removeDemo } from '@/data/demo'
import { createBackup, deleteAllData, isBackup, restoreBackup } from '@/data/backup'
import { useI18n } from '@/i18n'
import { useAppSettings } from '@/app/context'
import { cn, downloadBlob } from '@/lib/utils'
import { Button } from '@/ui/Button'
import { Card, SectionTitle } from '@/ui/Card'
import { Field, Input } from '@/ui/Field'
import { Segmented } from '@/ui/Segmented'
import { ShiftChip } from '@/ui/ShiftChip'
import { useToast } from '@/ui/Toast'
import { useConfirm } from '@/ui/useConfirm'
import { ShiftTypeSheet } from './ShiftTypeSheet'
import { ImportSheet } from './ImportSheet'

const VERSION = '0.1.0'

export function SettingsScreen() {
  const { t, lang } = useI18n()
  const settings = useAppSettings()
  const { list } = useShiftTypes()
  const toast = useToast()
  const [confirmEl, confirm] = useConfirm()
  const [editing, setEditing] = useState<ShiftType | 'new' | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const restoreRef = useRef<HTMLInputElement>(null)
  const demoCount = useLiveQuery(() => db.entries.where('source').equals('demo').count()) ?? 0
  const imports = useChanges(100).filter((c) => c.kind === 'import').slice(0, 6)
  const [persistent, setPersistent] = useState<boolean | null>(null)

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersistent)
  }, [])

  const exportBackup = async () => {
    const b = await createBackup()
    downloadBlob(new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' }), `shiftflow-backup-${zonedNow().key}.json`)
    toast({ text: t('settings.exported') })
  }

  const onRestoreFile = async (file: File) => {
    try {
      const data = JSON.parse(await file.text())
      if (!isBackup(data)) throw new Error('invalid')
      const ok = await confirm({
        title: t('settings.restoreTitle'),
        message: t('settings.restoreText', { date: new Date(data.exportedAt).toLocaleString(lang === 'de' ? 'de-CH' : 'en-GB') }),
        confirmLabel: t('settings.restore'),
        danger: true,
      })
      if (!ok) return
      await restoreBackup(data)
      toast({ text: t('settings.restored') })
    } catch {
      toast({ text: t('settings.invalidBackup'), tone: 'error' })
    }
  }

  return (
    <div className="space-y-7">
      <header className="px-1 pt-2">
        <h1 className="text-[28px] font-semibold tracking-tight">{t('nav.settings')}</h1>
      </header>

      <Group title={t('settings.profile')}>
        <div className="p-4">
          <Field label={t('settings.name')}>
            <DebouncedInput value={settings.name} onCommit={(v) => updateSettings({ name: v.trim() })} />
          </Field>
        </div>
      </Group>

      <Group title={t('settings.appearance')}>
        <div className="space-y-4 p-4">
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-muted">{t('settings.theme')}</p>
            <Segmented
              id="theme"
              value={settings.theme}
              onChange={(v) => updateSettings({ theme: v })}
              options={[
                { value: 'system', label: t('theme.system') },
                { value: 'light', label: t('theme.light') },
                { value: 'dark', label: t('theme.dark') },
              ]}
            />
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-muted">{t('settings.language')}</p>
            <Segmented
              id="lang"
              value={settings.language}
              onChange={(v) => updateSettings({ language: v })}
              options={[{ value: 'en', label: 'English' }, { value: 'de', label: 'Deutsch' }]}
            />
          </div>
        </div>
      </Group>

      <Group title={t('settings.shiftTypes')}>
        <div className="divide-y divide-line/60">
          {list.map((ty) => (
            <button
              key={ty.id}
              type="button"
              onClick={() => setEditing(ty)}
              className={cn('flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-field', ty.archived && 'opacity-50')}
            >
              <ShiftChip type={ty} className="min-w-11" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">{ty.name}</p>
                <p className="truncate text-[12.5px] text-muted">
                  {ty.kind === 'work' && ty.startMin != null && ty.endMin != null ? `${fmtHM(ty.startMin)} – ${fmtHM(ty.endMin)}` : t(`kind.${ty.kind}`)}
                  {ty.kind === 'work' && ` · ${ty.breakMin != null ? `${ty.breakMin} min` : t('today.breakNotSet')}`}
                  {ty.aliases.length > 0 && ` · ${ty.aliases.join(', ')}`}
                  {ty.archived && ` · ${t('type.archived')}`}
                </p>
              </div>
              <ChevronRight className="size-4 text-muted" />
            </button>
          ))}
          <button type="button" onClick={() => setEditing('new')} className="flex w-full items-center gap-3 px-4 py-3.5 text-[15px] font-semibold text-accent">
            <Plus className="size-5" /> {t('settings.addType')}
          </button>
        </div>
      </Group>

      <Group title={t('settings.contract')}>
        <ContractFields settings={settings} />
      </Group>

      <Group title={t('settings.import')}>
        <div className="space-y-3 p-4">
          <Button block onClick={() => setImportOpen(true)}>
            <FileUp /> {t('settings.importButton')}
          </Button>
          <p className="text-[12.5px] leading-relaxed text-muted">{t('settings.importHint')}</p>
          {settings.importIgnore.length > 0 && (
            <p className="text-[12.5px] text-muted">{t('settings.ignored', { codes: settings.importIgnore.join(', ') })}</p>
          )}
        </div>
        <div className="border-t border-line/60 px-4 py-3">
          <p className="mb-2 text-[13px] font-semibold">{t('settings.history')}</p>
          {imports.length === 0 && <p className="text-[13px] text-muted">{t('settings.historyEmpty')}</p>}
          <div className="space-y-2">
            {imports.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-[14px] font-medium', c.undone && 'text-muted line-through')}>{c.importMeta?.source ?? c.label}</p>
                  <p className="text-[12px] text-muted">
                    {t('settings.historyItem', { date: new Date(c.createdAt).toLocaleString(lang === 'de' ? 'de-CH' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }), n: c.importMeta?.count ?? c.after.length })}
                    {c.undone && ` · ${t('settings.undone')}`}
                  </p>
                </div>
                {!c.undone && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      let res = await undoChange(c.id)
                      if (!res.ok) {
                        const ok = await confirm({
                          title: t('cal.undoConflictTitle'),
                          message: t('cal.undoConflictText', { n: res.conflicts }),
                          confirmLabel: t('cal.undoAnyway'),
                        })
                        if (!ok) return
                        res = await undoChange(c.id, true)
                      }
                      toast({ text: t('cal.undone', { label: c.label }) })
                    }}
                  >
                    <RotateCcw /> {t('common.undo')}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </Group>

      <Group title={t('settings.demo')}>
        <div className="space-y-3 p-4">
          <p className="text-[12.5px] leading-relaxed text-muted">{t('settings.demoHint')}</p>
          {demoCount > 0 ? (
            <Button variant="secondary" block onClick={async () => { await removeDemo(t('settings.demoRemoved')); toast({ text: t('settings.demoRemoved') }) }}>
              <Trash2 /> {t('settings.demoRemove', { n: demoCount })}
            </Button>
          ) : (
            <Button
              variant="secondary"
              block
              onClick={async () => {
                const cs = await loadDemo(zonedNow().key, t('settings.demoLoaded'))
                toast({ text: cs ? t('settings.demoLoaded') : t('settings.demoNothing') })
              }}
            >
              <Sparkles /> {t('settings.demoLoad')}
            </Button>
          )}
        </div>
      </Group>

      <Group title={t('settings.data')}>
        <div className="grid gap-2 p-4">
          <Button variant="secondary" block onClick={exportBackup}><Download /> {t('settings.export')}</Button>
          <input
            ref={restoreRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void onRestoreFile(f)
            }}
          />
          <Button variant="secondary" block onClick={() => restoreRef.current?.click()}><Upload /> {t('settings.restore')}</Button>
          <Button
            variant="danger"
            block
            onClick={async () => {
              const ok = await confirm({ title: t('settings.deleteAllTitle'), message: t('settings.deleteAllText'), confirmLabel: t('settings.deleteAll'), danger: true })
              if (!ok) return
              await deleteAllData()
              toast({ text: t('settings.deletedAll') })
            }}
          >
            <Trash2 /> {t('settings.deleteAll')}
          </Button>
        </div>
        <div className="flex items-start gap-2.5 border-t border-line/60 px-4 py-3 text-[12.5px] text-muted">
          <Database className="mt-0.5 size-4 shrink-0" />
          <span>{persistent ? t('settings.storagePersistent') : t('settings.storageBestEffort')}</span>
        </div>
      </Group>

      <div className="flex flex-col items-center gap-1 pb-4 pt-2 text-center">
        <img src="icon.svg" alt="" className="size-11 rounded-[13px]" />
        <p className="mt-1 text-[15px] font-semibold">ShiftFlow</p>
        <p className="text-[12.5px] text-muted">{t('app.tagline')}</p>
        <p className="text-[12px] text-muted">{t('settings.version', { v: VERSION })} · {fmtDate(zonedNow().key, lang, { year: 'numeric' })}</p>
      </div>

      <ShiftTypeSheet editing={editing} all={list} onClose={() => setEditing(null)} />
      <ImportSheet open={importOpen} onClose={() => setImportOpen(false)} />
      {confirmEl}
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <Card className="overflow-hidden">{children}</Card>
    </section>
  )
}

/** Saves on blur / Enter so typing does not write to the database on every key. */
function DebouncedInput({ value, onCommit, ...rest }: { value: string; onCommit: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return (
    <Input
      {...rest}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onCommit(v)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}

function ContractFields({ settings }: { settings: Settings }) {
  const { t } = useI18n()
  const num = (s: string) => (s.trim() === '' ? undefined : Number(s))
  return (
    <div className="space-y-4 p-4">
      <Field label={t('settings.weeklyHours')} hint={t('settings.weeklyHoursHint')}>
        <DebouncedInput
          type="number"
          inputMode="decimal"
          min={0}
          step={0.5}
          placeholder={t('common.notSet')}
          value={settings.weeklyTargetMin != null ? String(settings.weeklyTargetMin / 60) : ''}
          onCommit={(v) => {
            const h = num(v)
            void updateSettings({ weeklyTargetMin: h != null && h > 0 ? Math.round(h * 60) : undefined })
          }}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('settings.vacationDays')}>
          <DebouncedInput
            type="number"
            inputMode="numeric"
            min={0}
            value={String(settings.vacationDaysPerYear)}
            onCommit={(v) => { const n = num(v); if (n != null && n >= 0) void updateSettings({ vacationDaysPerYear: Math.round(n) }) }}
          />
        </Field>
        <Field label={t('settings.publicHolidays')}>
          <DebouncedInput
            type="number"
            inputMode="numeric"
            min={0}
            value={String(settings.publicHolidaysPerYear)}
            onCommit={(v) => { const n = num(v); if (n != null && n >= 0) void updateSettings({ publicHolidaysPerYear: Math.round(n) }) }}
          />
        </Field>
      </div>
      <Field label={t('settings.location')}>
        <DebouncedInput value={settings.defaultLocation} onCommit={(v) => updateSettings({ defaultLocation: v.trim() })} />
      </Field>
    </div>
  )
}
