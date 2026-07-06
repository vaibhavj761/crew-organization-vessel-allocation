import { Building2, Ship, UserCog, Users } from 'lucide-react'
import { useChart } from '../state/ChartContext'

export function DashboardPage() {
  const { data } = useChart()
  const crewManagers = data.operationsManagers.flatMap((op) => op.crewManagers)
  const assistants = crewManagers.flatMap((cm) => cm.assistants)

  return (
    <div className="vessel-master dashboard-page">
      <div className="master-heading">
        <div>
          <h2>Dashboard</h2>
          <p>Current organization, hierarchy, and vessel allocation snapshot from the database.</p>
        </div>
      </div>

      <div className="admin-summary-grid dashboard-summary-grid">
        <div className="admin-summary-card"><span><Building2 size={16} /></span><strong>{data.organizationName || 'Organization'}</strong><small>{data.title}</small></div>
        <div className="admin-summary-card"><span><UserCog size={16} /></span><strong>{data.operationsManagers.length}</strong><small>Operations managers</small></div>
        <div className="admin-summary-card"><span><Users size={16} /></span><strong>{crewManagers.length}</strong><small>Crew managers · {assistants.length} assistants</small></div>
        <div className="admin-summary-card"><span><Ship size={16} /></span><strong>{data.vessels.length}</strong><small>Vessels in planner</small></div>
      </div>

      <div className="admin-link-panel">
        <strong>Presentation readiness</strong>
        <p>Use Organization Chart for leadership overview, Operations Detail for team pages, and Vessel Allocation for dense vessel presentation exports.</p>
      </div>
    </div>
  )
}
