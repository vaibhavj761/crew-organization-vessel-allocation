import { Copy, MoveRight, X } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { HierarchyPlacementPayload } from '../state/ChartContext'

export type PendingHierarchyPlacement = Omit<HierarchyPlacementPayload, 'action'> & {
  entityName: string
  parentName: string
  entityLabel: string
  parentLabel: string
}

export function HierarchyPlacementDialog({
  placement,
  onClose,
  onConfirm,
}: {
  placement: PendingHierarchyPlacement
  onClose: () => void
  onConfirm: (action: 'MOVE' | 'COPY') => Promise<void>
}) {
  const [busy, setBusy] = useState<'MOVE' | 'COPY' | ''>('')
  const [error, setError] = useState('')
  const isCrewManager = placement.entityType === 'CREW_MANAGER'
  const moveLabel = isCrewManager ? 'Move Crew Manager with vessels' : `Move ${placement.entityLabel} with team`
  const copyLabel = isCrewManager ? 'Add Crew Manager only' : `Add ${placement.entityLabel} only`
  const moveDescription = isCrewManager
    ? 'Move this Crew Manager and every allocated vessel to this branch. Other reporting placements will be removed.'
    : 'Move this employee and the team currently under their primary reporting branch. Other reporting placements will be removed.'
  const copyDescription = isCrewManager
    ? 'Keep the current reporting line and vessels unchanged, and show only this Crew Manager in the selected branch.'
    : 'Keep the current team and reporting line unchanged, and show only this employee in the selected branch.'

  const confirm = async (action: 'MOVE' | 'COPY') => {
    setBusy(action)
    setError('')
    try {
      await onConfirm(action)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this reporting relationship.')
    } finally {
      setBusy('')
    }
  }

  return createPortal(
    <div className="dialog-backdrop hierarchy-placement-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <section className="dialog hierarchy-placement-dialog" role="dialog" aria-modal="true" aria-labelledby="hierarchy-placement-title">
        <div className="allocation-dialog__heading">
          <div><span>Reporting relationship</span><h3 id="hierarchy-placement-title">What would you like to move?</h3></div>
          <button className="icon-button" type="button" onClick={onClose} disabled={Boolean(busy)} aria-label="Close dialog"><X size={16} /></button>
        </div>
        <div className="hierarchy-placement-summary">
          <span>{placement.entityLabel}</span>
          <strong>{placement.entityName}</strong>
          <small>Destination: {placement.parentLabel} · {placement.parentName}</small>
        </div>
        <div className="hierarchy-placement-options">
          <button type="button" className="hierarchy-placement-option" onClick={() => void confirm('MOVE')} disabled={Boolean(busy)}>
            <span><MoveRight size={19} /></span>
            <strong>{busy === 'MOVE' ? 'Moving…' : moveLabel}</strong>
            <small>{moveDescription}</small>
          </button>
          <button type="button" className="hierarchy-placement-option" onClick={() => void confirm('COPY')} disabled={Boolean(busy)}>
            <span><Copy size={18} /></span>
            <strong>{busy === 'COPY' ? 'Adding…' : copyLabel}</strong>
            <small>{copyDescription}</small>
          </button>
        </div>
        <p className="helper-copy hierarchy-placement-note">Employee details remain one shared record. Direct reports must be added to the new branch individually, and every vessel remains allocated in one place only.</p>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="dialog-actions">
          <button className="button secondary" type="button" onClick={onClose} disabled={Boolean(busy)}>Cancel</button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
