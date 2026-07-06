import { AlertTriangle } from 'lucide-react'

export function ConfirmDialog({ title, message, onCancel, onConfirm }: { title: string; message: string; onCancel: () => void; onConfirm: () => void }) {
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onCancel}><div className="dialog" role="alertdialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}><span className="warning-icon"><AlertTriangle size={20} /></span><h3>{title}</h3><p>{message}</p><div className="dialog-actions"><button className="button secondary" onClick={onCancel}>Cancel</button><button className="button danger" onClick={onConfirm}>Delete</button></div></div></div>
}
