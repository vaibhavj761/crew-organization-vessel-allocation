import type { CrewManagerNode, Vessel } from '../types'
import { type DragEvent, useState } from 'react'
import { getVesselColumnCount } from '../utils/operationsAllocation'
import { getViewportVesselColumnCount } from '../utils/chartLayout'
import { VesselTag } from './VesselTag'
import { Pencil, Plus, Trash2, X } from 'lucide-react'

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
  onRemoveFromChart,
  removeFromChartDisabled = false,
  onAssignVessel,
  onEditVessel,
  onUnassignVessel,
  selectedVesselIds,
  onToggleVesselSelection,
  onToggleAllVessels,
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
  onRemoveFromChart?: () => void
  removeFromChartDisabled?: boolean
  onAssignVessel?: () => void
  onEditVessel?: (vessel: Vessel) => void
  onUnassignVessel?: (vessel: Vessel) => void
  selectedVesselIds?: Set<string>
  onToggleVesselSelection?: (vesselId: string) => void
  onToggleAllVessels?: (vessels: Vessel[]) => void
  onVesselDrop?: (vesselIds: string[]) => void
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
        if (!event.dataTransfer.types.includes('application/x-crew-vessel') && !event.dataTransfer.types.includes('application/x-crew-vessels')) return
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
        const vesselIdsPayload = event.dataTransfer.getData('application/x-crew-vessels')
        let vesselIds: string[] = []
        try { vesselIds = vesselIdsPayload ? JSON.parse(vesselIdsPayload) as string[] : [] } catch { vesselIds = [] }
        if (!vesselIds.length && vesselId) vesselIds = [vesselId]
        if (!vesselIds.length) return
        event.preventDefault()
        setVesselDropActive(false)
        onVesselDrop(vesselIds)
      } : undefined}
    >
      <header className="team-header">
        {onEdit || onRemoveFromChart ? <div className="team-header-actions">
          {onEdit ? <button type="button" className="chart-inline-edit" onClick={onEdit} aria-label={`Edit ${team.person.name}`} title="Edit name and designation"><Pencil size={12} /></button> : null}
          {onRemoveFromChart ? <button type="button" className="chart-inline-remove" onClick={onRemoveFromChart} disabled={removeFromChartDisabled} aria-label={`Remove ${team.person.name} from organization chart`} title={removeFromChartDisabled ? 'Move or unassign this placement’s vessels before removing it' : 'Remove from this reporting branch'}><Trash2 size={13} /></button> : null}
        </div> : null}
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
          {onToggleAllVessels && vessels.length ? <button type="button" className="allocation-select-all" onClick={() => onToggleAllVessels(vessels)}>{vessels.every((vessel) => selectedVesselIds?.has(vessel.id)) ? 'Clear team' : 'Select all'}</button> : null}
          {onAssignVessel ? <button type="button" className="allocation-add-button" onClick={onAssignVessel}><Plus size={12} /> Assign vessel</button> : null}
        </div>

        <div className={`vessel-list ${vesselNamesOnly ? `vessel-name-grid columns-${vesselColumns}` : ''}`}>
          {visible.length ? visible.map((vessel) => (
            vesselNamesOnly ? (
              <span
                key={vessel.id}
                className={`vessel-name-pill ${onEditVessel ? 'vessel-name-pill--editable' : ''} ${onVesselDrop ? 'vessel-name-pill--draggable' : ''} ${selectedVesselIds?.has(vessel.id) ? 'vessel-name-pill--selected' : ''}`}
                title={selectedVesselIds?.has(vessel.id) && selectedVesselIds.size > 1 ? `Drag ${selectedVesselIds.size} selected vessels` : vessel.name}
                draggable={Boolean(onVesselDrop)}
                onDragStart={onVesselDrop ? (event) => {
                  event.stopPropagation()
                  event.dataTransfer.effectAllowed = 'move'
                  const draggedVesselIds = selectedVesselIds?.has(vessel.id) ? [...selectedVesselIds] : [vessel.id]
                  setVesselDragPreview(event, draggedVesselIds.length, vessel.name)
                  event.dataTransfer.setData('application/x-crew-vessels', JSON.stringify(draggedVesselIds))
                  event.dataTransfer.setData('application/x-crew-vessel', vessel.id)
                  event.dataTransfer.setData('text/plain', vessel.name)
                } : undefined}
              >
                {onToggleVesselSelection ? <label className="vessel-selection-check" title={`Select ${vessel.name}`}><input type="checkbox" checked={selectedVesselIds?.has(vessel.id) || false} onChange={() => onToggleVesselSelection(vessel.id)} aria-label={`Select ${vessel.name}`} /></label> : null}
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

function setVesselDragPreview(event: DragEvent<HTMLElement>, vesselCount: number, vesselName: string) {
  if (vesselCount < 2 || typeof event.dataTransfer.setDragImage !== 'function') return
  const preview = document.createElement('div')
  preview.className = 'multi-vessel-drag-preview'
  const count = document.createElement('strong')
  count.textContent = `Moving ${vesselCount} vessels`
  const detail = document.createElement('span')
  detail.textContent = `${vesselName} + ${vesselCount - 1} more`
  preview.append(count, detail)
  document.body.appendChild(preview)
  event.dataTransfer.setDragImage(preview, 24, 24)
  window.setTimeout(() => preview.remove(), 0)
}
