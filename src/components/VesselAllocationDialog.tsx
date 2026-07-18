import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CrewManagerNode, Vessel } from '../types'

type DialogMode = 'assign' | 'edit' | 'unassign'

export function VesselAllocationDialog({
  mode,
  team,
  vessel,
  vessels,
  onClose,
  onAssign,
  onSave,
  onUnassign,
}: {
  mode: DialogMode
  team: CrewManagerNode
  vessel?: Vessel
  vessels: Vessel[]
  onClose: () => void
  onAssign: (vesselId: string) => Promise<void>
  onSave: (vessel: Vessel) => Promise<void>
  onUnassign: (vesselId: string) => Promise<void>
}) {
  const unassigned = useMemo(() => vessels.filter((item) => !item.crewManagerId), [vessels])
  const [selectedVesselId, setSelectedVesselId] = useState(unassigned[0]?.id || '')
  const [draft, setDraft] = useState<Vessel | null>(vessel ? { ...vessel } : null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    setBusy(true)
    try {
      if (mode === 'assign') await onAssign(selectedVesselId)
      if (mode === 'edit' && draft) await onSave(draft)
      if (mode === 'unassign' && vessel) await onUnassign(vessel.id)
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not complete this vessel update.')
    } finally {
      setBusy(false)
    }
  }

  const update = <K extends keyof Vessel>(key: K, value: Vessel[K]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current)
  }

  const title = mode === 'assign' ? `Assign vessel to ${team.person.name}` : mode === 'edit' ? 'Review vessel details' : 'Remove vessel allocation'
  const action = mode === 'assign' ? 'Confirm assignment' : mode === 'edit' ? 'Confirm vessel update' : 'Remove allocation'

  return createPortal(
    <div className="dialog-backdrop allocation-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <section className="dialog allocation-dialog" role="dialog" aria-modal="true" aria-labelledby="vessel-dialog-title">
        <div className="allocation-dialog__heading">
          <div><span>Vessel allocation</span><h3 id="vessel-dialog-title">{title}</h3></div>
          <button className="icon-button" type="button" onClick={onClose} disabled={busy} aria-label="Close dialog">×</button>
        </div>

        {mode === 'assign' ? (
          <>
            <p className="helper-copy">Choose an unassigned Vessel Master record. The vessel remains available in Vessel Master after it is removed from a team.</p>
            <label className="field"><span>Unassigned vessel</span><select value={selectedVesselId} onChange={(event) => setSelectedVesselId(event.target.value)} disabled={busy || !unassigned.length}>
              {unassigned.length ? unassigned.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.vesselType || 'Type not set'}</option>) : <option value="">No unassigned vessels available</option>}
            </select></label>
          </>
        ) : mode === 'edit' && draft ? (
          <>
            <p className="helper-copy">Review the changes carefully. Nothing is saved until you confirm below.</p>
            <div className="allocation-form-grid">
              <label className="field"><span>Vessel name *</span><input value={draft.name} onChange={(event) => update('name', event.target.value)} /></label>
              <label className="field"><span>Vessel type *</span><input value={draft.vesselType} onChange={(event) => update('vesselType', event.target.value)} /></label>
              <label className="field"><span>Status</span><select value={draft.vesselStatus} onChange={(event) => update('vesselStatus', event.target.value as Vessel['vesselStatus'])}><option value="IN_MANAGEMENT">Active / In management</option><option value="UPCOMING">Upcoming</option><option value="OUT_OF_MANAGEMENT">Out of management</option></select></label>
              <label className="field"><span>Management type</span><select value={draft.managementType} onChange={(event) => update('managementType', event.target.value as Vessel['managementType'])}><option value="FULL_MANAGED">Fully managed</option><option value="CREW_MANAGED">Crew managed</option></select></label>
              <label className="field"><span>DOC</span><input value={draft.vesselDoc} onChange={(event) => update('vesselDoc', event.target.value)} /></label>
              <label className="field"><span>Deadweight tonnage</span><input value={draft.deadweightTonnage} onChange={(event) => update('deadweightTonnage', event.target.value)} /></label>
              <label className="field"><span>Owner / pool</span><input value={draft.ownerPool} onChange={(event) => update('ownerPool', event.target.value)} /></label>
              <label className="field"><span>Owner name</span><input value={draft.ownerName} onChange={(event) => update('ownerName', event.target.value)} /></label>
              <label className="field allocation-form-wide"><span>Vessel manager</span><input value={draft.vesselManager} onChange={(event) => update('vesselManager', event.target.value)} /></label>
              <label className="field allocation-form-wide"><span>Notes</span><textarea rows={3} value={draft.notes} onChange={(event) => update('notes', event.target.value)} /></label>
            </div>
          </>
        ) : (
          <div className="allocation-removal-summary"><strong>{vessel?.name}</strong><span>will be removed from {team.person.name}'s allocation.</span><p>The Vessel Master record will not be deleted.</p></div>
        )}

        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="dialog-actions">
          <button className="button secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button className={`button ${mode === 'unassign' ? 'danger-button' : ''}`} type="button" onClick={() => void submit()} disabled={busy || (mode === 'assign' && !selectedVesselId)}>{busy ? 'Saving…' : action}</button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
