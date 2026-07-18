import type { CrewManagerNode, Vessel } from '../types'
import { getVesselColumnCount } from '../utils/operationsAllocation'
import { getViewportVesselColumnCount } from '../utils/chartLayout'
import { VesselTag } from './VesselTag'
import { Pencil, Plus, Unlink } from 'lucide-react'

export function TeamCard({
  team,
  vessels,
  compact = false,
  allocation = false,
  vesselNamesOnly = false,
  showVessels = true,
  onEdit,
  onAssignVessel,
  onEditVessel,
  onUnassignVessel,
}: {
  team: CrewManagerNode
  vessels: Vessel[]
  compact?: boolean
  allocation?: boolean
  vesselNamesOnly?: boolean
  showVessels?: boolean
  onEdit?: () => void
  onAssignVessel?: () => void
  onEditVessel?: (vessel: Vessel) => void
  onUnassignVessel?: (vessel: Vessel) => void
}) {
  const visible = vesselNamesOnly ? vessels : vessels.slice(0, compact ? 3 : 12)
  const vesselColumns = vesselNamesOnly ? getVesselColumnCount(vessels.length) : allocation ? 2 : getViewportVesselColumnCount(vessels.length)
  const countLabel = showVessels ? `${vessels.length} vessels` : vessels.length ? String(vessels.length) : team.person.notes

  return (
    <article className={`team-card ${allocation ? 'allocation-card' : ''} ${vesselNamesOnly ? 'names-only-card' : ''} ${showVessels ? '' : 'structure-card'} vessels-${Math.min(vesselColumns, 3)}`}>
      <header className="team-header">
        {onEdit ? <button type="button" className="chart-inline-edit" onClick={onEdit} aria-label={`Edit ${team.person.name}`} title="Edit name and designation"><Pencil size={12} /></button> : null}
        <div className="manager-avatar">{team.person.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div>
        <div className="team-header-copy">
          <h3>{team.person.name || 'Unnamed manager'}</h3>
          <p className="team-designation">{team.person.designation || 'Designation not set'}</p>
        </div>
        {countLabel ? <b className="vessel-count">{countLabel}</b> : null}
      </header>

      {showVessels ? <section className="team-section vessel-section">
        <div className="section-label">
          <span>{vesselNamesOnly ? 'Allocated vessel names' : 'Vessel allocation'}</span>
          <b>{vessels.length}</b>
          {onAssignVessel ? <button type="button" className="allocation-add-button" onClick={onAssignVessel}><Plus size={12} /> Assign vessel</button> : null}
        </div>

        <div className={`vessel-list ${vesselNamesOnly ? `vessel-name-grid columns-${vesselColumns}` : ''}`}>
          {visible.length ? visible.map((vessel) => (
            vesselNamesOnly ? (
              <span
                key={vessel.id}
                className={`vessel-name-pill ${onEditVessel ? 'vessel-name-pill--editable' : ''}`}
                title={vessel.name}
              >
                {onEditVessel ? <button type="button" className="vessel-name-button" onClick={() => onEditVessel(vessel)}>{vessel.name}</button> : <span>{vessel.name}</span>}
                {onUnassignVessel ? <button type="button" className="vessel-unassign-button" onClick={() => onUnassignVessel(vessel)} title={`Remove ${vessel.name} from this allocation`} aria-label={`Remove ${vessel.name} from this allocation`}><Unlink size={11} /></button> : null}
              </span>
            ) : (
              <VesselTag key={vessel.id} vessel={vessel} detailed={allocation} />
            )
          )) : <span className="empty-copy">No vessels assigned yet</span>}

          {!vesselNamesOnly && vessels.length > (compact ? 3 : 12) && (
            <span className="overflow-summary">{vessels.length - (compact ? 3 : 12)} more vessels in detail view</span>
          )}
        </div>
      </section> : null}
    </article>
  )
}
