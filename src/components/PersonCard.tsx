import { Mail, Pencil, Phone } from 'lucide-react'
import type { Person } from '../types'

export function PersonCard({ person, compact = false, level = 'standard', onEdit }: { person: Person; eyebrow?: string; compact?: boolean; level?: 'head' | 'operations' | 'standard'; onEdit?: () => void }) {
  const levelLabel = level === 'head' ? 'Crew Director' : level === 'operations' ? 'Crew Operations Manager' : 'Team member'
  return (
    <article className={`person-card ${compact ? 'compact' : ''} level-${level}`}>
      {onEdit ? <button type="button" className="chart-inline-edit" onClick={onEdit} aria-label={`Edit ${person.name}`} title="Edit name and designation"><Pencil size={13} /></button> : null}
      <span className="person-level-label">{levelLabel}</span>
      <h2>{person.name || 'Name not set'}</h2>
      <p className="designation">{person.designation || 'Designation'}</p>
      {(person.email || person.phone) && <div className="person-contact">
        {person.email && <span><Mail size={11} />{person.email}</span>}
        {person.phone && <span><Phone size={11} />{person.phone}</span>}
      </div>}
    </article>
  )
}
