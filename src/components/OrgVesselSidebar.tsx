import { GripVertical, PanelRightClose, Plus, Search, Ship, X } from 'lucide-react'
import type { Vessel } from '../types'

export interface VesselSearchResult {
  vessel: Vessel
  location: string
  assigned: boolean
}

export function OrgVesselSidebar({
  open,
  unassignedVessels,
  searchQuery,
  searchResults,
  canEdit,
  onToggle,
  onSearchChange,
  onAddVessel,
}: {
  open: boolean
  unassignedVessels: Vessel[]
  searchQuery: string
  searchResults: VesselSearchResult[]
  canEdit: boolean
  onToggle: () => void
  onSearchChange: (value: string) => void
  onAddVessel: () => void
}) {
  return (
    <>
      <div className="org-vessel-toolbar">
        <label className="org-vessel-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search Vessel Master</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search vessel name to find its Crew Manager"
          />
          {searchQuery ? <button type="button" onClick={() => onSearchChange('')} aria-label="Clear vessel search"><X size={14} /></button> : null}
        </label>
        <button type="button" className="button secondary org-vessel-toggle" onClick={onToggle} aria-expanded={open}>
          <Ship size={16} />
          Unassigned vessels
          <b>{unassignedVessels.length}</b>
        </button>
        {searchQuery.trim() ? (
          <div className="org-vessel-search-results" role="status" aria-live="polite">
            {searchResults.length ? searchResults.map(({ vessel, location, assigned }) => (
              <div key={vessel.id} className={`org-vessel-search-result ${assigned ? '' : 'is-unassigned'}`}>
                <strong>{vessel.name}</strong>
                <span>{assigned ? location : 'Unassigned · available in vessel drawer'}</span>
              </div>
            )) : <div className="org-vessel-search-empty">No vessel name matches “{searchQuery.trim()}”.</div>}
          </div>
        ) : null}
      </div>

      {open ? <aside className="org-vessel-sidebar is-open" aria-label="Unassigned Vessel Master records">
        <header>
          <div>
            <span>Vessel Master</span>
            <h2>Unassigned vessels</h2>
            <p>Drag a vessel onto a Crew Manager card to allocate it.</p>
          </div>
          <button type="button" className="icon-button" onClick={onToggle} aria-label="Close unassigned vessel panel"><PanelRightClose size={18} /></button>
        </header>
        {canEdit ? <button type="button" className="button org-vessel-add" onClick={onAddVessel}><Plus size={15} /> Add new vessel</button> : null}
        <div className="org-vessel-sidebar__list">
          {unassignedVessels.length ? unassignedVessels.map((vessel) => {
            const matches = searchQuery.trim() && vessel.name.toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase())
            return (
              <article
                key={vessel.id}
                className={`org-unassigned-vessel ${matches ? 'is-search-match' : ''}`}
                draggable={canEdit}
                onDragStart={canEdit ? (event) => {
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('application/x-crew-vessel', vessel.id)
                  event.dataTransfer.setData('text/plain', vessel.name)
                } : undefined}
              >
                {canEdit ? <GripVertical size={15} aria-hidden="true" /> : <Ship size={15} aria-hidden="true" />}
                <div><strong>{vessel.name}</strong><span>{vessel.vesselType || 'Vessel type not set'}</span></div>
                {matches ? <b>Match</b> : null}
              </article>
            )
          }) : (
            <div className="org-vessel-sidebar__empty">
              <Ship size={22} />
              <strong>No unassigned vessels</strong>
              <span>Every Vessel Master record is currently allocated.</span>
            </div>
          )}
        </div>
      </aside> : null}
    </>
  )
}
