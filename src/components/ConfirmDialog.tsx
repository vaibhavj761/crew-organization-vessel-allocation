import { AlertTriangle } from 'lucide-react'

export function ConfirmDialog({ title, message, confirmLabel = 'Delete', busyLabel = 'Working…', busy = false, onCancel, onConfirm }: { title: string; message: string; confirmLabel?: string; busyLabel?: string; busy?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="dialog-backdrop" role="presentation" onMouseDown={busy ? undefined : onCancel}><div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" onMouseDown={(e) => e.stopPropagation()}><span className="warning-icon"><AlertTriangle size={20} /></span><h3 id="confirm-dialog-title">{title}</h3><p>{message}</p><div className="dialog-actions"><button type="button" className="button secondary" onClick={onCancel} disabled={busy}>Cancel</button><button type="button" className="button danger" onClick={onConfirm} disabled={busy}>{busy ? busyLabel : confirmLabel}</button></div></div></div>
}
