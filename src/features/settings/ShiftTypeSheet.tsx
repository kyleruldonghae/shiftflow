import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import type { ShiftKind, ShiftType } from '@/domain/types'
import { fmtHM, parseHM } from '@/domain/time'
import { db } from '@/data/db'
import { uid } from '@/data/repo'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/Button'
import { Field, Input, Switch } from '@/ui/Field'
import { Sheet } from '@/ui/Sheet'
import { useToast } from '@/ui/Toast'
import { useConfirm } from '@/ui/useConfirm'

const SWATCHES = ['#B8D8C0', '#B8D5EF', '#D4C5ED', '#F2C49E', '#C4CCD0', '#F0D98C', '#E8A5A5', '#8DD5D1', '#CBDDE6', '#F5B8C8', '#C9E4A6', '#A9C7E8']
const KINDS: ShiftKind[] = ['work', 'off', 'vacation', 'sick', 'publicHoliday']

interface Form {
  code: string
  name: string
  kind: ShiftKind
  color: string
  start: string
  end: string
  breakMin: string
  breakPaid: boolean
  aliases: string
  location: string
}

const empty: Form = { code: '', name: '', kind: 'work', color: SWATCHES[0], start: '', end: '', breakMin: '', breakPaid: false, aliases: '', location: '' }

function toForm(t: ShiftType): Form {
  return {
    code: t.code, name: t.name, kind: t.kind, color: t.color,
    start: t.startMin != null ? fmtHM(t.startMin) : '', end: t.endMin != null ? fmtHM(t.endMin) : '',
    breakMin: t.breakMin != null ? String(t.breakMin) : '', breakPaid: t.breakPaid,
    aliases: t.aliases.join(', '), location: t.location ?? '',
  }
}

/** Create or edit a shift type. `editing === 'new'` creates one. */
export function ShiftTypeSheet({ editing, all, onClose }: { editing: ShiftType | 'new' | null; all: ShiftType[]; onClose: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const [confirmEl, confirm] = useConfirm()
  const [form, setForm] = useState<Form>(empty)
  const [error, setError] = useState<{ field: keyof Form; msg: string } | null>(null)
  const current = editing && editing !== 'new' ? editing : undefined

  useEffect(() => {
    if (!editing) return
    setForm(editing === 'new' ? empty : toForm(editing))
    setError(null)
  }, [editing])

  const set = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }))

  const onSave = async () => {
    const code = form.code.trim().toUpperCase()
    const aliases = form.aliases.split(',').map((a) => a.trim().toUpperCase()).filter(Boolean)
    if (!code) return setError({ field: 'code', msg: t('type.errCode') })
    if (!form.name.trim()) return setError({ field: 'name', msg: t('type.errName') })
    for (const c of [code, ...aliases]) {
      const other = all.find((x) => x.id !== current?.id && (x.code.toUpperCase() === c || x.aliases.some((a) => a.toUpperCase() === c)))
      if (other) return setError({ field: c === code ? 'code' : 'aliases', msg: t('type.errDup', { code: c, name: other.name }) })
    }
    const startMin = parseHM(form.start)
    const endMin = parseHM(form.end)
    if (form.kind === 'work' && (startMin == null) !== (endMin == null)) return setError({ field: 'start', msg: t('type.errTimes') })
    const breakMin = form.breakMin.trim() === '' ? undefined : Math.max(0, Math.round(Number(form.breakMin)))
    const isWork = form.kind === 'work'
    const record: ShiftType = {
      id: current?.id ?? uid(),
      code,
      aliases,
      name: form.name.trim(),
      kind: form.kind,
      color: form.color,
      startMin: isWork ? startMin : undefined,
      endMin: isWork ? endMin : undefined,
      breakMin: isWork ? breakMin : undefined,
      breakPaid: isWork && form.breakPaid,
      location: form.location.trim() || undefined,
      archived: current?.archived ?? false,
      order: current?.order ?? Math.max(0, ...all.map((x) => x.order)) + 1,
    }
    await db.shiftTypes.put(record)
    toast({ text: t('type.saved') })
    onClose()
  }

  const onRemove = async () => {
    if (!current) return
    const used = await db.entries.where('shiftTypeId').equals(current.id).count()
    if (used === 0) {
      if (await confirm({ title: t('type.removeTitle'), message: t('type.removeText'), confirmLabel: t('common.delete'), danger: true })) {
        await db.shiftTypes.delete(current.id)
        onClose()
      }
    } else if (await confirm({ title: t('type.archiveTitle'), message: t('type.archiveText', { n: used }), confirmLabel: t('type.archive') })) {
      await db.shiftTypes.update(current.id, { archived: true })
      onClose()
    }
  }

  const err = (f: keyof Form) => (error?.field === f ? error.msg : undefined)

  return (
    <>
      <Sheet
        open={!!editing}
        onClose={onClose}
        title={editing === 'new' ? t('type.new') : t('type.edit')}
        closeLabel={t('common.close')}
        footer={
          <div className="flex gap-2">
            {current && !current.archived && (
              <Button variant="danger" onClick={onRemove}>{t('common.delete')}</Button>
            )}
            {current?.archived && (
              <Button variant="secondary" onClick={async () => { await db.shiftTypes.update(current.id, { archived: false }); onClose() }}>
                {t('type.unarchive')}
              </Button>
            )}
            <Button block onClick={onSave}>{t('common.save')}</Button>
          </div>
        }
      >
        <div className="grid grid-cols-[110px_1fr] gap-3">
          <Field label={t('type.code')} error={err('code')}>
            <Input value={form.code} maxLength={6} onChange={(e) => set({ code: e.target.value })} className="uppercase" />
          </Field>
          <Field label={t('type.name')} error={err('name')}>
            <Input value={form.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} />
          </Field>
        </div>

        <p className="mb-1.5 mt-4 text-[13px] font-medium text-muted">{t('type.kind')}</p>
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => set({ kind: k })}
              className={cn('h-9 rounded-xl px-3 text-[13px] font-semibold transition', form.kind === k ? 'bg-accent text-accent-fg' : 'bg-field')}
            >
              {t(`kind.${k}`)}
            </button>
          ))}
        </div>

        <p className="mb-1.5 mt-4 text-[13px] font-medium text-muted">{t('type.color')}</p>
        <div className="flex flex-wrap items-center gap-2">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => set({ color: c })}
              className="grid size-9 place-items-center rounded-full ring-offset-2 ring-offset-sheet transition active:scale-90"
              style={{ background: c, boxShadow: form.color.toLowerCase() === c.toLowerCase() ? '0 0 0 2px var(--accent)' : undefined }}
            >
              {form.color.toLowerCase() === c.toLowerCase() && <Check className="size-4 text-ink" />}
            </button>
          ))}
          <label className="relative grid size-9 cursor-pointer place-items-center overflow-hidden rounded-full border-2 border-dashed border-line text-[10px] font-bold text-muted">
            +
            <input type="color" value={form.color} onChange={(e) => set({ color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
        </div>

        {form.kind === 'work' && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label={t('editor.start')} error={err('start')}>
                <Input type="time" value={form.start} onChange={(e) => set({ start: e.target.value })} />
              </Field>
              <Field label={t('editor.end')}>
                <Input type="time" value={form.end} onChange={(e) => set({ end: e.target.value })} />
              </Field>
            </div>
            <div className="mt-3 grid grid-cols-2 items-end gap-3">
              <Field label={t('type.break')} hint={t('type.breakHint')}>
                <Input type="number" inputMode="numeric" min={0} step={5} placeholder={t('common.notSet')} value={form.breakMin} onChange={(e) => set({ breakMin: e.target.value })} />
              </Field>
              <div className="pb-6">
                <Switch checked={form.breakPaid} onChange={(v) => set({ breakPaid: v })} label={t('type.breakPaid')} />
              </div>
            </div>
          </>
        )}

        <Field label={t('type.aliases')} hint={t('type.aliasesHint')} error={err('aliases')} className="mt-4">
          <Input value={form.aliases} onChange={(e) => set({ aliases: e.target.value })} placeholder="063, AFR" />
        </Field>
        <Field label={t('type.location')} className="mt-4">
          <Input value={form.location} onChange={(e) => set({ location: e.target.value })} />
        </Field>
      </Sheet>
      {confirmEl}
    </>
  )
}
