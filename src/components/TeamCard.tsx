import type { CrewManagerNode, Vessel } from '../types'
import { getVesselColumnCount } from '../utils/operationsAllocation'
import { AssistantChip } from './AssistantChip'
import { VesselTag } from './VesselTag'

export function TeamCard({
  team,
  vessels,
  compact = false,
  allocation = false,
  vesselNamesOnly = false,
}: {
  team: CrewManagerNode
  vessels: Vessel[]
  compact?: boolean
  allocation?: boolean
  vesselNamesOnly?: boolean
}) {
  const visible = vesselNamesOnly ? vessels : vessels.slice(0, compact ? 3 : 12)
  const vesselColumns = vesselNamesOnly ? getVesselColumnCount(vessels.length) : allocation ? 2 : 1

  return (
    <article className={`team-card ${allocation ? 'allocation-card' : ''} ${vesselNamesOnly ? 'names-only-card' : ''} assistants-${Math.min(team.assistants.length || 1, 3)}`}>
      <header className="team-header">
        <div className="manager-avatar">{team.person.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div>
        <div className="team-header-copy">
          <h3>{team.person.name || 'Unnamed manager'}</h3>
          <p className="team-designation">{team.person.designation || 'Designation not set'}</p>
        </div>
        <b className="vessel-count">{vessels.length} vessels</b>
      </header>

      <section className="team-section assistants-section">
        <div className="section-label">
          <span>Support team</span>
          <b>{team.assistants.length}</b>
        </div>
        <div className="assistant-list">
          {team.assistants.length
            ? team.assistants.map((assistant) => <AssistantChip key={assistant.id} assistant={assistant} />)
            : <span className="empty-copy">No assistants assigned yet</span>}
        </div>
      </section>

      <section className="team-section vessel-section">
        <div className="section-label">
          <span>{vesselNamesOnly ? 'Allocated vessel names' : 'Vessel allocation'}</span>
          <b>{vessels.length}</b>
        </div>

        <div className={`vessel-list ${vesselNamesOnly ? `vessel-name-grid columns-${vesselColumns}` : ''}`}>
          {visible.length ? visible.map((vessel) => (
            vesselNamesOnly ? (
              <span
                key={vessel.id}
                className="vessel-name-pill"
                title={vessel.name}
              >
                {vessel.name}
              </span>
            ) : (
              <VesselTag key={vessel.id} vessel={vessel} assistants={team.assistants} detailed={allocation} />
            )
          )) : <span className="empty-copy">No vessels assigned yet</span>}

          {!vesselNamesOnly && vessels.length > (compact ? 3 : 12) && (
            <span className="overflow-summary">{vessels.length - (compact ? 3 : 12)} more vessels in detail view</span>
          )}
        </div>
      </section>
    </article>
  )
}
