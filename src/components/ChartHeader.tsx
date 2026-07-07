import { CalendarDays } from 'lucide-react'
import { useChart } from '../state/ChartContext'
import { APP_NAME } from '../constants/app'

export function ChartHeader({
  allocation = false,
  title,
  subtitle,
}: {
  allocation?: boolean
  title?: string
  subtitle?: string
}) {
  const { data } = useChart()
  const date = data.effectiveDate ? new Date(`${data.effectiveDate}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not specified'
  return <header className={`chart-header ${allocation ? 'allocation' : ''}`}><div><span className="org-name">{data.organizationName || APP_NAME}</span><h1>{title || (allocation ? 'Operations & Vessel Allocation' : 'Organization Chart')}</h1>{subtitle ? <p className="chart-subtitle">{subtitle}</p> : null}</div><div className="effective-date"><CalendarDays size={13} /><span>Effective date<strong>{date}</strong></span></div></header>
}
