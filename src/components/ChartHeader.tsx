import { CalendarDays } from 'lucide-react'
import { useChart } from '../state/ChartContext'

export function ChartHeader({ allocation = false }: { allocation?: boolean }) {
  const { data } = useChart()
  const date = data.effectiveDate ? new Date(`${data.effectiveDate}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not specified'
  return <header className={`chart-header ${allocation ? 'allocation' : ''}`}><div><span className="org-name">{data.organizationName || 'Organization name'}</span><h1>{allocation ? 'Vessel Allocation Overview' : 'Crew Organization Overview'}</h1></div><div className="effective-date"><CalendarDays size={13} /><span>Effective date<strong>{date}</strong></span></div></header>
}
