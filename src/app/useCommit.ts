import { useCallback } from 'react'
import { commit, undoChange, type EntryUpdate } from '@/data/repo'
import type { ChangeKind } from '@/domain/types'
import { useI18n } from '@/i18n'
import { useToast } from '@/ui/Toast'

/** Writes changes and shows a toast with an Undo button. */
export function useCommit() {
  const { t } = useI18n()
  const toast = useToast()
  return useCallback(
    async (label: string, kind: ChangeKind, updates: EntryUpdate[]) => {
      if (!updates.length) return null
      try {
        const cs = await commit(label, kind, updates)
        toast({
          text: label,
          action: {
            label: t('common.undo'),
            run: () => {
              void undoChange(cs.id, true).then(() => toast({ text: t('cal.undone', { label }) }))
            },
          },
        })
        return cs
      } catch (err) {
        console.error(err)
        toast({ text: t('error.save'), tone: 'error' })
        return null
      }
    },
    [t, toast],
  )
}
