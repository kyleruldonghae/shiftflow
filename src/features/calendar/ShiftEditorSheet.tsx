import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Info, Trash2 } from 'lucide-react'
import type { DateKey, ShiftEntry, ShiftType } from '@/domain/types'
import { fmtDate, fmtDuration, fmtHM, parseHM } from '@/domain/time'
import { actualGrossMinutes, crossesMidnight, grossMinutes, netFromGross, resolve } from '@/domain/shiftCalc'
import { db } from '@/data/db'
import { useShiftTypes } from '@/data/hooks'
import { useI18n } from '@/i18n'
import { useCommit } from '@/app/useCommit'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/Button'
import { Field, Input, Switch, Textarea } from '@/ui/Field'
import { Sheet } from '@/ui/Sheet'
import { TypeGrid } from '@/ui/ShiftChip'
import { useConfirm } from '@/ui/useConfirm'

interface Form {
  typeId: string
  start: string
  end: string
  breakMin: string
  breakPaid: boolean
  actualOpen: boolean
  actualStart: string
  actualEnd: string
  note: string
}

function formFor(entry: ShiftEntry | undefined, type: ShiftType | undefined): Form {
  const r = entry && type ? resolve(entry, type) : undefined
  return {
    typeId: entry?.shiftTypeId ?? '',
    start: r?.startMin != null ? fmtHM(r.startMin) : type?.startMin != null ? fmtHM(type.startMin) : '',
    end: r?.endMin != null ? fmtHM(r.endMin) : type?.endMin != null ? fmtHM(type.endMin) : '',
    breakMin: r?.breakMin != null ? String(r.breakMin) : '',
    breakPaid: r?.breakPaid ?? type?.breakPaid ?? false,
    actualOpen: entry?.actualStartMin != null,
    actualStart: entry?.actualStartMin != null ? fmtHM(entry.actualStartMin) : '',
    actualEnd: entry?.actualEndMin != null ? fmtHM(entry.actualEndMin) : '',
    note: entry?.note ?? '',
  }
}

/** Only store values that differ from the shift type, so later type edits still apply to this day. */
function override(value: number | undefined, typeValue: number | undefined) {
  return value != null && value !== typeValue ? value : undefined
}

export function ShiftEditorSheet({ date, onClose }: { date: DateKey | null; onClose: () => void }) {
  const { t, lang } = useI18n()
  const { active, map: types } = useShiftTypes()
  const save = useCommit()
  const [confirmEl, confirm] = useConfirm()
  // Keep the last date while the sheet animates out
  const lastDate = useRef<DateKey | null>(null)
  if (date) lastDate.current = date
  const d = date ?? lastDate.current

  const loaded = useLiveQuery(async () => (d ? { e: await db.entries.get(d) } : undefined), [d])
  const entry = loaded?.e
  const [form, setForm] = useState<Form>(() => formFor(undefined, undefined))

  // Reset the form whenever another day is opened or the stored day changes
  useEffect(() => {
    if (!date || !loaded) return
    setForm(formFor(loaded.e, loaded.e ? types.get(loaded.e.shiftTypeId) : undefined))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, loaded?.e?.updatedAt, loaded === undefined])

  const type = types.get(form.typeId)
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }))
  const pick = (id: string) => {
    const nt = types.get(id)
    if (!nt) return
    set({
      typeId: id,
      start: nt.startMin != null ? fmtHM(nt.startMin) : '',
      end: nt.endMin != null ? fmtHM(nt.endMin) : '',
      breakMin: nt.breakMin != null ? String(nt.breakMin) : '',
      breakPaid: nt.breakPaid,
    })
  }

  const startMin = parseHM(form.start)
  const endMin = parseHM(form.end)
  const breakMin = form.breakMin.trim() === '' ? undefined : Math.max(0, Math.round(Number(form.breakMin)))
  const isWork = type?.kind === 'work'
  const preview = type && d
    ? resolve({ date: d, shiftTypeId: type.id, startMin, endMin, breakMin, breakPaid: form.breakPaid, source: 'manual', updatedAt: 0 }, type)
    : undefined
  const gross = preview ? grossMinutes(preview) : undefined
  const net = netFromGross(gross, breakMin, form.breakPaid)
  const actualStart = parseHM(form.actualStart)
  const actualEnd = parseHM(form.actualEnd)
  const actualGross = preview && d
    ? actualGrossMinutes({ date: d, shiftTypeId: form.typeId, actualStartMin: actualStart, actualEndMin: actualEnd, source: 'manual', updatedAt: 0 }, preview)
    : undefined
  const actualNet = netFromGross(actualGross, breakMin, form.breakPaid)
  const timesValid = !isWork || type?.startMin == null || (startMin != null && endMin != null)

  const dateLabel = d ? fmtDate(d, lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const shortDate = d ? fmtDate(d, lang, { day: 'numeric', month: 'short' }) : ''

  const onSave = async () => {
    if (!d || !type) return
    const actualOn = form.actualOpen && actualStart != null && actualEnd != null
    const ok = await save(t('editor.saved', { date: shortDate }), 'edit', [{
      date: d,
      entry: {
        shiftTypeId: type.id,
        startMin: isWork ? override(startMin, type.startMin) : undefined,
        endMin: isWork ? override(endMin, type.endMin) : undefined,
        breakMin: isWork ? override(breakMin, type.breakMin) : undefined,
        breakPaid: isWork && form.breakPaid !== type.breakPaid ? form.breakPaid : undefined,
        actualStartMin: isWork && actualOn ? actualStart : undefined,
        actualEndMin: isWork && actualOn ? actualEnd : undefined,
        note: form.note.trim() || undefined,
        // Editing a demo or imported day makes it the user's own entry
        source: 'manual',
      },
    }])
    if (ok) onClose()
  }

  const onRemove = async () => {
    if (!d) return
    const ok = await confirm({
      title: t('editor.removeTitle'),
      message: t('editor.removeText', { date: dateLabel }),
      confirmLabel: t('editor.remove'),
      danger: true,
    })
    if (!ok) return
    await save(t('editor.removed', { date: shortDate }), 'clear', [{ date: d, entry: null }])
    onClose()
  }

  return (
    <>
      <Sheet
        open={!!date}
        onClose={onClose}
        title={dateLabel}
        closeLabel={t('common.close')}
        footer={
          <div className="flex gap-2">
            {entry && (
              <Button variant="danger" aria-label={t('editor.remove')} onClick={onRemove} className="w-12 px-0">
                <Trash2 />
              </Button>
            )}
            <Button block onClick={onSave} disabled={!type || !timesValid}>
              {t('common.save')}
            </Button>
          </div>
        }
      >
        {entry?.source === 'demo' && <Notice text={t('editor.demoNote')} />}
        {entry?.source === 'import' && <Notice text={t('editor.importNote')} />}

        <p className="mb-2.5 text-[13px] font-medium text-muted">{form.typeId ? t('editor.shift') : t('editor.pickFirst')}</p>
        <TypeGrid types={active.concat(type && type.archived ? [type] : [])} selectedId={form.typeId} onPick={pick} />

        <AnimatePresence initial={false}>
          {isWork && (
            <motion.div
              key="work"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Field label={t('editor.start')}>
                  <Input type="time" value={form.start} onChange={(e) => set({ start: e.target.value })} />
                </Field>
                <Field label={t('editor.end')}>
                  <Input type="time" value={form.end} onChange={(e) => set({ end: e.target.value })} />
                </Field>
              </div>
              {startMin != null && endMin != null && crossesMidnight(startMin, endMin) && (
                <p className="mt-1.5 text-xs font-medium text-accent">{t('editor.endsNextDay')}</p>
              )}
              <div className="mt-3 grid grid-cols-2 items-end gap-3">
                <Field label={t('editor.break')}>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={5}
                    placeholder={t('common.notSet')}
                    value={form.breakMin}
                    onChange={(e) => set({ breakMin: e.target.value })}
                  />
                </Field>
                <div className="pb-1.5">
                  <Switch checked={form.breakPaid} onChange={(v) => set({ breakPaid: v })} label={t('editor.breakPaid')} />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-field p-3.5">
                <Metric label={t('editor.length')} value={gross != null ? fmtDuration(gross, lang) : '–'} />
                <Metric label={t('editor.net')} value={net != null ? fmtDuration(net, lang) : '–'} hint={net == null ? t('editor.netUnknown') : undefined} />
              </div>

              <button
                type="button"
                onClick={() => set({ actualOpen: !form.actualOpen })}
                className="mt-4 flex w-full items-center justify-between py-1 text-[15px] font-semibold"
              >
                {t('editor.actual')}
                <ChevronDown className={cn('size-5 text-muted transition-transform', form.actualOpen && 'rotate-180')} />
              </button>
              {form.actualOpen && (
                <div className="pt-1">
                  <p className="mb-2 text-xs text-muted">{t('editor.actualHint')}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t('editor.start')}>
                      <Input type="time" value={form.actualStart} onChange={(e) => set({ actualStart: e.target.value })} />
                    </Field>
                    <Field label={t('editor.end')}>
                      <Input type="time" value={form.actualEnd} onChange={(e) => set({ actualEnd: e.target.value })} />
                    </Field>
                  </div>
                  {actualGross != null && (
                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-field p-3.5">
                      <Metric label={t('editor.actualWorked')} value={fmtDuration(actualNet ?? actualGross, lang)} />
                      <Metric
                        label={t('editor.difference')}
                        value={gross != null ? `${actualGross - gross >= 0 ? '+' : ''}${fmtDuration(actualGross - gross, lang)}` : '–'}
                      />
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <Field label={t('editor.note')} className="mt-5">
          <Textarea value={form.note} placeholder={t('editor.notePlaceholder')} onChange={(e) => set({ note: e.target.value })} maxLength={500} />
        </Field>
      </Sheet>
      {confirmEl}
    </>
  )
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-[12px] font-medium text-muted">{label}</p>
      <p className="text-[17px] font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] leading-snug text-muted">{hint}</p>}
    </div>
  )
}

function Notice({ text }: { text: string }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-2xl bg-field px-3.5 py-2.5 text-[13px] text-muted">
      <Info className="mt-0.5 size-4 shrink-0" />
      <span>{text}</span>
    </div>
  )
}
