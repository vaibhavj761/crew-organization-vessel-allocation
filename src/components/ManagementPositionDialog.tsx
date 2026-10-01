import { Check, Layers3, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useChart } from '../state/ChartContext'
import type { ManagementHierarchyPositionNode } from '../types'

export function ManagementPositionDialog({ crewDirectorId, parentPositionId, parentName, existing, levelNames, onClose }: {
  crewDirectorId: string
  parentPositionId?: string | null
  parentName: string
  existing?: ManagementHierarchyPositionNode
  levelNames: string[]
  onClose: () => void
}) {
  const { createManagementPosition, updateManagementPosition } = useChart()
  const [levelName, setLevelName] = useState(existing?.levelName || '')
  const [name, setName] = useState(existing?.person.name || '')
  const [designation, setDesignation] = useState(existing?.person.designation || '')
  const [email, setEmail] = useState(existing?.person.email || '')
  const [phone, setPhone] = useState(existing?.person.phone || '')
  const [notes, setNotes] = useState(existing?.person.notes || '')
  const [adoptDirectReports, setAdoptDirectReports] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const levelRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    levelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, saving])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!levelName.trim()) return setError('Level name is required.')
    if (!name.trim()) return setError('Name is required.')
    if (!designation.trim()) return setError('Designation is required.')
    setSaving(true)
    setError('')
    try {
      const payload = {
        crewDirectorId,
        parentPositionId: parentPositionId || null,
        levelName: levelName.trim(),
        name: name.trim(),
        designation: designation.trim(),
        email: email.trim(),
        phone: phone.trim(),
        notes: notes.trim(),
        adoptDirectReports,
      }
      if (existing) await updateManagementPosition(existing.id, payload)
      else await createManagementPosition(payload)
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this management position.')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="record-dialog-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose()
    }}>
      <form className="record-dialog hierarchy-create-dialog" role="dialog" aria-modal="true" aria-labelledby="management-position-title" onSubmit={submit}>
        <header>
          <div><span>Flexible organization hierarchy</span><h2 id="management-position-title">{existing ? 'Edit management position' : 'Add reporting level'}</h2></div>
          <button type="button" className="icon-button" onClick={onClose} disabled={saving} aria-label="Close management position dialog"><X size={18} /></button>
        </header>
        <p className="record-dialog__intro"><Layers3 size={16} aria-hidden="true" /> This position reports to <strong>{parentName}</strong>. Add further levels beneath it whenever needed.</p>
        <div className="record-dialog__grid">
          <label className="field-span-2">Level name <span aria-hidden="true">*</span>
            <input ref={levelRef} list="management-level-suggestions" value={levelName} onChange={(event) => { setLevelName(event.target.value); setError('') }} placeholder="e.g. Head of Crew Management" maxLength={120} disabled={saving} />
            <datalist id="management-level-suggestions">{levelNames.map((level) => <option value={level} key={level} />)}</datalist>
          </label>
          <label>Name <span aria-hidden="true">*</span><input value={name} onChange={(event) => { setName(event.target.value); setError('') }} maxLength={160} disabled={saving} /></label>
          <label>Designation <span aria-hidden="true">*</span><input value={designation} onChange={(event) => { setDesignation(event.target.value); setError('') }} maxLength={160} disabled={saving} /></label>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} disabled={saving} /></label>
          <label>Phone<input value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={80} disabled={saving} /></label>
          <label className="field-span-2">Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} maxLength={2000} disabled={saving} /></label>
          {!existing ? <label className="management-adopt-option field-span-2"><input type="checkbox" checked={adoptDirectReports} onChange={(event) => setAdoptDirectReports(event.target.checked)} disabled={saving} /><span><strong>Place current direct reports beneath this new position</strong><small>Recommended when inserting a new layer into the existing reporting chain.</small></span></label> : null}
        </div>
        {error ? <div className="record-dialog__error" role="alert">{error}</div> : null}
        <footer><span><b>*</b> Required fields</span><div><button type="button" className="button secondary" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="button" disabled={saving || !levelName.trim() || !name.trim() || !designation.trim()}><Check size={15} />{saving ? 'Saving…' : existing ? 'Save position' : 'Add level'}</button></div></footer>
      </form>
    </div>,
    document.body,
  )
}
