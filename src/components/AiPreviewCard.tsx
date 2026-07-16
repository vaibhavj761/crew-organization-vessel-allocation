import { AlertTriangle, CheckCircle2, Info, ShieldCheck, XCircle } from 'lucide-react'
import type { AiPreviewResponse } from '../types'
import { StatusBadge } from './ui'

function label(value: string) {
  return value.split('_').filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ')
}

function statusTone(status: AiPreviewResponse['status']): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'ready') return 'success'
  if (status === 'needs_clarification' || status === 'not_configured') return 'warning'
  if (status === 'blocked' || status === 'error') return 'danger'
  return 'neutral'
}

export function AiPreviewCard({
  preview,
  busy,
  onConfirm,
  onCancel,
}: {
  preview: AiPreviewResponse
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const canConfirm = preview.status === 'ready' && preview.requiresConfirmation && Boolean(preview.previewId)
  return (
    <section className={`ai-preview-card ai-preview-card--${preview.status}`} aria-live="polite">
      <header className="ai-preview-header">
        <div className="ai-preview-icon" aria-hidden="true">
          {preview.status === 'ready' ? <ShieldCheck size={20} /> : preview.status === 'needs_clarification' ? <Info size={20} /> : <AlertTriangle size={20} />}
        </div>
        <div>
          <span className="page-eyebrow">Safe update preview</span>
          <h2>{preview.summary}</h2>
        </div>
        <StatusBadge tone={statusTone(preview.status)}>{label(preview.status)}</StatusBadge>
      </header>

      <div className="ai-preview-metadata">
        <span><small>Domain</small><strong>{preview.domain === 'unsupported' ? 'Not applicable' : label(preview.domain)}</strong></span>
        <span><small>Action</small><strong>{preview.action === 'unsupported' ? 'Unsupported' : label(preview.action)}</strong></span>
        <span><small>Confidence</small><strong>{Math.round((preview.confidence || 0) * 100)}%</strong></span>
        <span><small>Provider</small><strong>{label(preview.providerUsed)}</strong></span>
        <span><small>Fallback</small><strong>{preview.fallbackUsed ? 'Used' : 'Not used'}</strong></span>
      </div>

      <div className="ai-understanding">
        <strong>How the instruction was understood</strong>
        <p>{preview.reasoningSummary || preview.summary}</p>
      </div>

      {preview.errorCategory ? <div className="ai-inline-state ai-inline-state--error"><AlertTriangle size={16} /><div><strong>{label(preview.errorCategory)}</strong><p>{preview.summary}</p></div></div> : null}
      {preview.fallbackUsed ? <div className="ai-inline-state ai-inline-state--warning"><Info size={16} /><div><strong>Deterministic fallback used</strong><p>{preview.fallbackReason || 'The configured provider could not confidently complete this request.'}</p></div></div> : null}
      {preview.clarifyingQuestion ? <div className="ai-inline-state ai-inline-state--question"><Info size={16} /><div><strong>Clarification needed</strong><p>{preview.clarifyingQuestion}</p></div></div> : null}

      {preview.changes.length ? (
        <div className="ai-changes-wrap">
          <div className="ai-changes-title"><strong>Proposed changes</strong><span>{preview.changes.length} field{preview.changes.length === 1 ? '' : 's'}</span></div>
          <table className="ai-changes">
            <thead><tr><th>Entity</th><th>Field</th><th>Current</th><th>Proposed</th></tr></thead>
            <tbody>{preview.changes.map((item, index) => <tr key={`${item.entity}-${item.field}-${index}`}><td>{item.entity}</td><td>{item.field}</td><td>{item.oldValue || 'Not set'}</td><td><strong>{item.newValue || 'Not set'}</strong></td></tr>)}</tbody>
          </table>
        </div>
      ) : null}
      {preview.warnings.length ? <div className="ai-warning-list"><strong>Review notes</strong><ul>{preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}

      <footer className="ai-confirm-row">
        <div className="ai-confirm-note"><ShieldCheck size={15} /><span>Nothing is saved until you confirm. Batch previews are applied all-or-nothing.</span></div>
        <button className="button secondary" type="button" onClick={onCancel} disabled={busy}><XCircle size={14} />Cancel</button>
        <button className="button" type="button" onClick={onConfirm} disabled={busy || !canConfirm}><CheckCircle2 size={14} />{busy ? 'Applying…' : 'Confirm update'}</button>
      </footer>
    </section>
  )
}
