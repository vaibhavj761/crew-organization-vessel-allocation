import type { ReactNode } from 'react'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="page-header">
      <div className="page-header__copy">
        {eyebrow ? <span className="page-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  )
}

export function StatCard({
  icon,
  label,
  value,
  detail,
  tone = 'default',
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  detail?: string
  tone?: 'default' | 'attention' | 'positive'
}) {
  return (
    <article className={`stat-card stat-card--${tone}`}>
      <span className="stat-card__icon" aria-hidden="true">{icon}</span>
      <div className="stat-card__copy">
        <span>{label}</span>
        <strong>{value}</strong>
        {detail ? <small>{detail}</small> : null}
      </div>
    </article>
  )
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className = '',
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`section-card ${className}`.trim()}>
      <header className="section-card__header">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="section-card__actions">{actions}</div> : null}
      </header>
      <div className="section-card__body">{children}</div>
    </section>
  )
}

export function EmptyState({ icon, title, description }: { icon?: ReactNode; title: string; description: string }) {
  return (
    <div className="empty-state">
      {icon ? <span className="empty-state__icon" aria-hidden="true">{icon}</span> : null}
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  )
}

export function StatusBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
}) {
  return <span className={`status-badge status-badge--${tone}`}>{children}</span>
}
