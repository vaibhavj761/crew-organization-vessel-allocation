import type { CrewManagerNode, Vessel } from '../types'
import { type DragEvent, useState } from 'react'
import { getVesselColumnCount } from '../utils/operationsAllocation'
import { getViewportVesselColumnCount } from '../utils/chartLayout'
import { VesselTag } from './VesselTag'
import { Pencil, Plus, X } from 'lucide-react'

export function TeamCard({
  team,
  vessels,
  compact = false,
  allocation = false,
  vesselNamesOnly = false,
  showVessels = true,
  showVesselCountTooltip = false,
  highlightedVessels = [],
  onEdit,
  onAssignVessel,
  onEditVessel,
  onUnassignVessel,
  onVesselDrop,
}: {
  team: CrewManagerNode
  vessels: Vessel[]
  compact?: boolean
  allocation?: boolean
  vesselNamesOnly?: boolean
  showVessels?: boolean
  showVesselCountTooltip?: boolean
  highlightedVessels?: Vessel[]
  onEdit?: () => void
  onAssignVessel?: () => void
  onEditVessel?: (vessel: Vessel) => void
  onUnassignVessel?: (vessel: Vessel) => void
  onVesselDrop?: (vesselId: string) => void
}) {
  const [vesselDropActive, setVesselDropActive] = useState(false)
  const visible = vesselNamesOnly ? vessels : vessels.slice(0, compact ? 3 : 12)
  const vesselColumns = vesselNamesOnly ? getVesselColumnCount(vessels.length) : allocation ? 2 : getViewportVesselColumnCount(vessels.length)
  // Vessel badges must always come from live allocation data. Person notes may
  // contain legacy capacity/count text and must never be treated as a total.
  const countLabel = showVessels ? `${vessels.length} vessels` : vessels.length ? String(vessels.length) : ''
  const vesselCountTitle = showVesselCountTooltip && vessels.length
    ? `Assigned vessels: ${vessels.map((vessel) => vessel.name).join(', ')}`
    : undefined

  return (
    <article
      className={`team-card ${allocation ? 'allocation-card' : ''} ${vesselNamesOnly ? 'names-only-card' : ''} ${showVessels ? '' : 'structure-card'} ${highlightedVessels.length ? 'team-card--search-match' : ''} ${onVesselDrop ? 'vessel-drop-target' : ''} ${vesselDropActive ? 'vessel-drop-target--active' : ''} vessels-${Math.min(vesselColumns, 3)}`}
      onDragOver={onVesselDrop ? (event: DragEvent<HTMLElement>) => {
        if (!event.dataTransfer.types.includes('application/x-crew-vessel')) return
        event.preventDefault()
        setVesselDropActive(true)
        event.dataTransfer.dropEffect = 'move'
      } : undefined}
      onDragLeave={onVesselDrop ? (event: DragEvent<HTMLElement>) => {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return
        setVesselDropActive(false)
      } : undefined}
      onDrop={onVesselDrop ? (event: DragEvent<HTMLElement>) => {
        const vesselId = event.dataTransfer.getData('application/x-crew-vessel')
        if (!vesselId) return
        event.preventDefault()
        setVesselDropActive(false)
        onVesselDrop(vesselId)
      } : undefined}
    >
      <header className="team-header">
        {onEdit ? <button type="button" className="chart-inline-edit" onClick={onEdit} aria-label={`Edit ${team.person.name}`} title="Edit name and designation"><Pencil size={12} /></button> : null}
        <div className="manager-avatar">{team.person.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div>
        <div className="team-header-copy">
          <h3>{team.person.name || 'Unnamed manager'}</h3>
          <p className="team-designation">{team.person.designation || 'Designation not set'}</p>
        </div>
        {countLabel ? (
          <b
            className={`vessel-count ${vesselCountTitle ? 'vessel-count--has-tooltip' : ''}`}
            aria-label={vesselCountTitle}
            tabIndex={vesselCountTitle ? 0 : undefined}
          >
            {countLabel}
            {vesselCountTitle ? (
              <span className="vessel-count-tooltip" role="tooltip">
                <strong>Assigned vessels</strong>
                {vessels.map((vessel) => <span key={vessel.id}>{vessel.name}</span>)}
              </span>
            ) : null}
          </b>
        ) : null}
      </header>

      {!showVessels && highlightedVessels.length ? (
        <div className="team-search-matches" aria-live="polite">
          {highlightedVessels.map((vessel) => <span key={vessel.id}><SearchMatchIcon />{vessel.name}</span>)}
        </div>
      ) : null}

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
                className={`vessel-name-pill ${onEditVessel ? 'vessel-name-pill--editable' : ''} ${onVesselDrop ? 'vessel-name-pill--draggable' : ''}`}
                title={vessel.name}
                draggable={Boolean(onVesselDrop)}
                onDragStart={onVesselDrop ? (event) => {
                  event.stopPropagation()
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('application/x-crew-vessel', vessel.id)
                  event.dataTransfer.setData('text/plain', vessel.name)
                } : undefined}
              >
                {onEditVessel ? <button type="button" className="vessel-name-button" onClick={() => onEditVessel(vessel)}>{vessel.name}</button> : <span>{vessel.name}</span>}
                {onUnassignVessel ? <button type="button" className="vessel-unassign-button" onClick={() => onUnassignVessel(vessel)} title={`Remove ${vessel.name} from this allocation`} aria-label={`Remove ${vessel.name} from this allocation`}><X size={13} strokeWidth={2.6} /></button> : null}
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

function SearchMatchIcon() {
  return <span className="team-search-match-dot" aria-hidden="true" />
}
