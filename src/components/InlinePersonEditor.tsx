import { Check, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Person } from '../types'

export function InlinePersonEditor({ person, levelLabel, onClose, onSave }: {
  person: Person
  levelLabel: string
  onClose: () => void
  onSave: (person: Person) => Promise<void>
}) {
  const [name, setName] = useState(person.name)
  const [designation, setDesignation] = useState(person.designation)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameInputRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, saving])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const normalizedName = name.trim()
    const normalizedDesignation = designation.trim()
    if (!normalizedName) {
      setError('Name is required.')
      return
    }
    if (!normalizedDesignation) {
      setError('Designation is required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave({ ...person, name: normalizedName, designation: normalizedDesignation })
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this chart update.')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="inline-person-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose()
    }}>
      <form className="inline-person-dialog" role="dialog" aria-modal="true" aria-labelledby="inline-person-title" onSubmit={submit}>
        <header>
          <div>
            <span>{levelLabel}</span>
            <h2 id="inline-person-title">Edit chart details</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} disabled={saving} aria-label="Close editor"><X size={18} /></button>
        </header>
        <p>Changes are saved securely to the live database and appear everywhere this person is shown.</p>
        <label>
          Name <span aria-hidden="true">*</span>
          <input ref={nameInputRef} value={name} onChange={(event) => setName(event.target.value)} maxLength={120} disabled={saving} />
        </label>
        <label>
          Designation <span aria-hidden="true">*</span>
          <input value={designation} onChange={(event) => setDesignation(event.target.value)} maxLength={160} disabled={saving} />
        </label>
        {error ? <div className="inline-person-error" role="alert">{error}</div> : null}
        <footer>
          <button type="button" className="button secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="button" disabled={saving || !name.trim() || !designation.trim()}>
            <Check size={15} />{saving ? 'Saving…' : 'Save to database'}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  )
}
