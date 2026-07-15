import { ArrowRight, Bot, Building2, CircleAlert, Network, Ship, UserCog, Users } from 'lucide-react'
import { useChart } from '../state/ChartContext'
import { getAllCrewManagers, getAllDeputyManagers } from '../utils/operationsAllocation'
import type { SafeUser, ViewMode } from '../types'
import { getRoleLabel } from '../utils/roles'
import { EmptyState, PageHeader, SectionCard, StatCard, StatusBadge } from './ui'

export function DashboardPage({ user, onNavigate }: { user?: SafeUser; onNavigate?: (view: ViewMode) => void }) {
  const { data } = useChart()
  const deputyManagers = getAllDeputyManagers(data)
  const crewManagers = getAllCrewManagers(data)
  const unassignedVessels = data.vessels.filter((vessel) => !vessel.crewManagerId)
  const incompleteVessels = data.vessels.filter((vessel) => !vessel.name.trim() || !vessel.vesselType.trim() || !vessel.crewManagerId)
  const inManagement = data.vessels.filter((vessel) => vessel.vesselStatus === 'IN_MANAGEMENT').length
  const upcoming = data.vessels.filter((vessel) => vessel.vesselStatus === 'UPCOMING').length

  return (
    <div className="dashboard-page page-surface">
      <PageHeader
        eyebrow="Operations workspace"
        title={`Welcome${user?.name ? `, ${user.name.split(/\s+/)[0]}` : ''}`}
        description="A live overview of your crew structure and vessel allocation data."
        actions={user ? <StatusBadge tone={user.role === 'ADMIN' ? 'info' : 'neutral'}>{getRoleLabel(user.role)} access</StatusBadge> : undefined}
      />

      <div className="dashboard-stat-grid">
        <StatCard icon={<UserCog size={19} />} label="Operations managers" value={data.operationsManagers.length} detail={`${data.crewDirectors.length} crew director${data.crewDirectors.length === 1 ? '' : 's'}`} />
        <StatCard icon={<Users size={19} />} label="Deputy managers" value={deputyManagers.length} detail={`${crewManagers.length} crew manager${crewManagers.length === 1 ? '' : 's'}`} />
        <StatCard icon={<Ship size={19} />} label="Vessel master" value={data.vessels.length} detail={`${inManagement} currently in management`} />
        <StatCard icon={<CircleAlert size={19} />} label="Needs attention" value={incompleteVessels.length} detail={`${unassignedVessels.length} unassigned vessel${unassignedVessels.length === 1 ? '' : 's'}`} tone={incompleteVessels.length ? 'attention' : 'positive'} />
      </div>

      <div className="dashboard-content-grid">
        <SectionCard title="Operational overview" description="Current database status by operational area.">
          <div className="operations-health-list">
            <div><span className="health-icon"><Building2 size={17} /></span><p><strong>{data.organizationName || 'Organization details not set'}</strong><small>{data.title || 'Chart title not set'}</small></p><StatusBadge tone="info">Live</StatusBadge></div>
            <div><span className="health-icon"><Network size={17} /></span><p><strong>{crewManagers.length} active crew manager structures</strong><small>{deputyManagers.length} deputy managers across {data.operationsManagers.length} operations managers</small></p><StatusBadge tone={crewManagers.length ? 'success' : 'warning'}>{crewManagers.length ? 'Ready' : 'Setup needed'}</StatusBadge></div>
            <div><span className="health-icon"><Ship size={17} /></span><p><strong>{inManagement} in management · {upcoming} upcoming</strong><small>{unassignedVessels.length ? `${unassignedVessels.length} vessels need an assignment` : 'All vessels have a Crew Manager assignment'}</small></p><StatusBadge tone={unassignedVessels.length ? 'warning' : 'success'}>{unassignedVessels.length ? 'Review' : 'Complete'}</StatusBadge></div>
          </div>
        </SectionCard>

        <SectionCard title="Quick actions" description="Open a live workspace using your current permissions.">
          <div className="quick-action-list">
            <button type="button" onClick={() => onNavigate?.('overview')}><span><Network size={17} /></span><div><strong>Review organization chart</strong><small>See the complete reporting structure</small></div><ArrowRight size={16} /></button>
            <button type="button" onClick={() => onNavigate?.('operations')}><span><Ship size={17} /></span><div><strong>Review vessel allocation</strong><small>See vessels by operations team</small></div><ArrowRight size={16} /></button>
            {user && (user.role === 'ADMIN' || user.role === 'EDITOR') ? <button type="button" onClick={() => onNavigate?.('ai')}><span><Bot size={17} /></span><div><strong>Open AI Assistant</strong><small>Generate a safe update preview</small></div><ArrowRight size={16} /></button> : null}
          </div>
        </SectionCard>
      </div>

      {!data.crewDirectors.length && !data.operationsManagers.length && !data.vessels.length ? <EmptyState icon={<Network size={21} />} title="Your operations workspace is ready" description="Add the first Crew Director and Operations Manager to begin building the live organization chart." /> : null}
    </div>
  )
}
