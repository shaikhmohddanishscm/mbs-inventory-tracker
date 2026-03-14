import { useEffect } from 'react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'

interface ConfirmModalProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  confirmVariant?: 'default' | 'destructive'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
  children?: ReactNode
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'destructive',
  busy = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        onCancel()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onCancel, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close confirmation dialog"
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={busy ? undefined : onCancel}
      />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl shadow-black/30">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className="mt-2 text-sm text-slate-300">{description}</p>
        
        {children}

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={confirmVariant} onClick={onConfirm} disabled={busy}>
            {busy ? 'Processing...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
