import type { Person } from '../types'

export function TextField({ label, value, onChange, type = 'text', placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label className="field"><span>{label}</span><input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>
}

export function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><textarea value={value} rows={2} onChange={(event) => onChange(event.target.value)} /></label>
}

export function PersonFields({ person, onChange }: { person: Person; onChange: (person: Person) => void }) {
  const update = (field: keyof Person, value: string) => onChange({ ...person, [field]: value })
  return <div className="form-grid"><TextField label="Name" value={person.name} onChange={(v) => update('name', v)} /><TextField label="Designation" value={person.designation} onChange={(v) => update('designation', v)} /><TextField label="Email" type="email" value={person.email} onChange={(v) => update('email', v)} /><TextField label="Phone" value={person.phone} onChange={(v) => update('phone', v)} /><div className="span-2"><TextAreaField label="Notes" value={person.notes} onChange={(v) => update('notes', v)} /></div></div>
}
