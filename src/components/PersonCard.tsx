import { Mail, Phone } from 'lucide-react'
import type { Person } from '../types'

export function PersonCard({ person, compact = false, level = 'standard' }: { person: Person; eyebrow?: string; compact?: boolean; level?: 'head' | 'operations' | 'standard' }) {
  return (
    <article className={`person-card ${compact ? 'compact' : ''} level-${level}`}>
      <h2>{person.name || 'Name not set'}</h2>
      <p className="designation">{person.designation || 'Designation'}</p>
      {(person.email || person.phone) && <div className="person-contact">
        {person.email && <span><Mail size={11} />{person.email}</span>}
        {person.phone && <span><Phone size={11} />{person.phone}</span>}
      </div>}
    </article>
  )
}
