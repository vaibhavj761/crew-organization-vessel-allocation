import { Check, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Vessel } from '../types'
import { createId } from '../utils/createId'
import { getAllCrewManagers } from '../utils/operationsAllocation'
import { validateVesselMasterFields } from '../utils/vesselValidation'
import { useChart } from '../state/ChartContext'

function emptyVessel(sortOrder: number): Vessel {
  return {
    id: createId(),
    name: '',
    vesselType: '',
    vesselDoc: '',
    deadweightTonnage: '',
    ownerPool: '',
    ownerName: '',
    vesselManager: '',
    crewManagerId: '',
    assignedAssistantId: '',
    vesselStatus: 'IN_MANAGEMENT',
    managementType: 'FULL_MANAGED',
    notes: '',
    sortOrder,
  }
}

export function VesselCreateDialog({ onClose }: { onClose: () => void }) {
  const { data, createVesselRecord } = useChart()
  const [vessel, setVessel] = useState(() => emptyVessel(data.vessels.length + 1))
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)
  const crewManagers = getAllCrewManagers(data)
  const validation = validateVesselMasterFields(vessel)

  useEffect(() => {
    nameRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, saving])

  const update = (patch: Partial<Vessel>) => {
    setVessel((current) => ({ ...current, ...patch }))
    setError('')
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (validation.name || validation.vesselType || validation.assignment) return
    setSaving(true)
    setError('')
    try {
      await createVesselRecord(vessel)
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not add the vessel.')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="record-dialog-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose()
    }}>
      <form className="record-dialog vessel-create-dialog" role="dialog" aria-modal="true" aria-labelledby="new-vessel-title" onSubmit={submit}>
        <header>
          <div>
            <span>Vessel Master</span>
            <h2 id="new-vessel-title">Add new vessel</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} disabled={saving} aria-label="Close new vessel dialog"><X size={18} /></button>
        </header>
        <p className="record-dialog__intro">Enter the vessel details and assignment. The record will be validated and saved directly to the database.</p>

        <div className="record-dialog__grid">
          <label className="field-span-2">
            Vessel name <span aria-hidden="true">*</span>
            <input ref={nameRef} value={vessel.name} onChange={(event) => update({ name: event.target.value })} maxLength={160} disabled={saving} aria-invalid={submitted && Boolean(validation.name)} />
            {submitted && validation.name ? <small className="field-error">{validation.name}</small> : null}
          </label>
          <label>
            Vessel type <span aria-hidden="true">*</span>
            <input value={vessel.vesselType} onChange={(event) => update({ vesselType: event.target.value })} maxLength={120} disabled={saving} aria-invalid={submitted && Boolean(validation.vesselType)} />
            {submitted && validation.vesselType ? <small className="field-error">{validation.vesselType}</small> : null}
          </label>
          <label>
            Assignment <span aria-hidden="true">*</span>
            <select value={vessel.crewManagerId} onChange={(event) => update({ crewManagerId: event.target.value })} disabled={saving} aria-invalid={submitted && Boolean(validation.assignment)}>
              <option value="">Select Crew Manager</option>
              {crewManagers.map((manager) => <option key={manager.id} value={manager.id}>{manager.person.name}</option>)}
            </select>
            {submitted && validation.assignment ? <small className="field-error">{validation.assignment}</small> : null}
          </label>
          <label>
            Vessel status
            <select value={vessel.vesselStatus} onChange={(event) => update({ vesselStatus: event.target.value as Vessel['vesselStatus'] })} disabled={saving}>
              <option value="IN_MANAGEMENT">In management</option>
              <option value="UPCOMING">Upcoming</option>
              <option value="OUT_OF_MANAGEMENT">Out of management</option>
            </select>
          </label>
          <label>
            Management type
            <select value={vessel.managementType} onChange={(event) => update({ managementType: event.target.value as Vessel['managementType'] })} disabled={saving}>
              <option value="FULL_MANAGED">Full managed</option>
              <option value="CREW_MANAGED">Crew managed</option>
            </select>
          </label>
          <label>
            DOC
            <input value={vessel.vesselDoc} onChange={(event) => update({ vesselDoc: event.target.value })} maxLength={160} disabled={saving} />
          </label>
          <label>
            Deadweight tonnage
            <input value={vessel.deadweightTonnage} onChange={(event) => update({ deadweightTonnage: event.target.value })} maxLength={80} disabled={saving} />
          </label>
          <label>
            Owner name
            <input value={vessel.ownerName} onChange={(event) => update({ ownerName: event.target.value })} maxLength={160} disabled={saving} />
          </label>
          <label>
            Owner pool
            <input value={vessel.ownerPool} onChange={(event) => update({ ownerPool: event.target.value })} maxLength={160} disabled={saving} />
          </label>
          <label className="field-span-2">
            Vessel manager
            <input value={vessel.vesselManager} onChange={(event) => update({ vesselManager: event.target.value })} maxLength={160} disabled={saving} />
          </label>
          <label className="field-span-2">
            Notes
            <textarea value={vessel.notes} onChange={(event) => update({ notes: event.target.value })} maxLength={1000} rows={3} disabled={saving} />
          </label>
        </div>

        {error ? <div className="record-dialog__error" role="alert">{error}</div> : null}
        <footer>
          <span><b>*</b> Required fields</span>
          <div>
            <button type="button" className="button secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="button" disabled={saving || !crewManagers.length} title={!crewManagers.length ? 'Add a Crew Manager before adding vessels.' : undefined}>
              <Check size={15} />{saving ? 'Saving…' : 'Add vessel'}
            </button>
          </div>
        </footer>
      </form>
    </div>,
    document.body,
  )
}
