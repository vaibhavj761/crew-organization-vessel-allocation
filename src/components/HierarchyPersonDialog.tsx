import { Check, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Person, WorkflowRole } from '../types'
import type { HierarchyCreateTarget } from '../state/ChartContext'
import { useChart } from '../state/ChartContext'
import { createId } from '../utils/createId'

const roleDetails: Record<WorkflowRole, { label: string; designation: string }> = {
  CREW_DIRECTOR: { label: 'Crew Director', designation: 'Crew Director' },
  OPERATIONS_MANAGER: { label: 'Crew Operations Manager', designation: 'Crew Operations Manager' },
  DEPUTY_MANAGER: { label: 'Deputy Manager', designation: 'Deputy Crew Manager' },
  CREW_MANAGER: { label: 'Crew Manager', designation: 'Crew Manager' },
  ASSISTANT: { label: 'Assistant', designation: 'Assistant Crew Manager' },
}

export function HierarchyPersonDialog({ target, role, parentName, onClose }: {
  target: HierarchyCreateTarget
  role: Exclude<WorkflowRole, 'ASSISTANT'>
  parentName?: string
  onClose: () => void
}) {
  const { createHierarchyPerson } = useChart()
  const details = roleDetails[role]
  const [person, setPerson] = useState<Person>({ id: createId(), name: '', designation: details.designation, workflowRole: role, email: '', phone: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, saving])

  const update = (patch: Partial<Person>) => {
    setPerson((current) => ({ ...current, ...patch }))
    setError('')
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!person.name.trim()) return setError('Name is required.')
    if (!person.designation.trim()) return setError('Designation is required.')
    setSaving(true)
    setError('')
    try {
      await createHierarchyPerson(target, person)
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : `Could not add the ${details.label}.`)
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="record-dialog-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose()
    }}>
      <form className="record-dialog hierarchy-create-dialog" role="dialog" aria-modal="true" aria-labelledby="new-hierarchy-person-title" onSubmit={submit}>
        <header>
          <div>
            <span>Organization hierarchy</span>
            <h2 id="new-hierarchy-person-title">Add {details.label}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} disabled={saving} aria-label="Close add person dialog"><X size={18} /></button>
        </header>
        <p className="record-dialog__intro">{parentName ? `This person will report directly to ${parentName}.` : 'This person will be added at the Crew Director level.'}</p>
        <div className="record-dialog__grid">
          <label className="field-span-2">
            Name <span aria-hidden="true">*</span>
            <input ref={nameRef} value={person.name} onChange={(event) => update({ name: event.target.value })} maxLength={120} disabled={saving} />
          </label>
          <label className="field-span-2">
            Designation <span aria-hidden="true">*</span>
            <input value={person.designation} onChange={(event) => update({ designation: event.target.value })} maxLength={160} disabled={saving} />
          </label>
          <label>
            Email
            <input type="email" value={person.email} onChange={(event) => update({ email: event.target.value })} maxLength={254} disabled={saving} />
          </label>
          <label>
            Phone
            <input value={person.phone} onChange={(event) => update({ phone: event.target.value })} maxLength={60} disabled={saving} />
          </label>
          <label className="field-span-2">
            Notes
            <textarea value={person.notes} onChange={(event) => update({ notes: event.target.value })} maxLength={1000} rows={3} disabled={saving} />
          </label>
        </div>
        {error ? <div className="record-dialog__error" role="alert">{error}</div> : null}
        <footer>
          <span><b>*</b> Required fields</span>
          <div>
            <button type="button" className="button secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="button" disabled={saving || !person.name.trim() || !person.designation.trim()}><Check size={15} />{saving ? 'Saving…' : `Add ${details.label}`}</button>
          </div>
        </footer>
      </form>
    </div>,
    document.body,
  )
}
