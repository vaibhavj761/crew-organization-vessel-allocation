import { GripVertical, Pencil, Plus } from 'lucide-react'
import { type DragEvent, useMemo, useState } from 'react'
import { useChart, type HierarchyCreateTarget, type HierarchyPersonTarget } from '../state/ChartContext'
import type { CrewManagerNode, Person, Vessel, WorkflowRole } from '../types'
import { ChartHeader } from './ChartHeader'
import { PersonCard } from './PersonCard'
import { TeamCard } from './TeamCard'
import { InlinePersonEditor } from './InlinePersonEditor'
import { HierarchyPersonDialog } from './HierarchyPersonDialog'
import { HierarchyPlacementDialog, type PendingHierarchyPlacement } from './HierarchyPlacementDialog'
import { getVesselPlacement, vesselBelongsToCrewManagerPlacement } from '../utils/operationsAllocation'
import { OrgVesselSidebar, type VesselSearchResult } from './OrgVesselSidebar'
import { VesselAllocationDialog } from './VesselAllocationDialog'
import { VesselCreateDialog } from './VesselCreateDialog'

type DraggedHierarchyEntity = {
  entityType: 'OPERATIONS_MANAGER' | 'DEPUTY_MANAGER' | 'CREW_MANAGER'
  entityId: string
  entityName: string
  entityLabel: string
}

type AddPersonState = {
  target: HierarchyCreateTarget
  role: Exclude<WorkflowRole, 'ASSISTANT'>
  parentName?: string
}

export function OrgChartView({ selectedDirectorId = '', canEdit = false }: { selectedDirectorId?: string; canEdit?: boolean }) {
  const { data, saveHierarchyPerson, updateHierarchyPlacement, assignVesselFromChart } = useChart()
  const [editing, setEditing] = useState<{ target: HierarchyPersonTarget; person: Person; levelLabel: string } | null>(null)
  const [adding, setAdding] = useState<AddPersonState | null>(null)
  const [dragging, setDragging] = useState<DraggedHierarchyEntity | null>(null)
  const [placement, setPlacement] = useState<PendingHierarchyPlacement | null>(null)
  const [vesselSidebarOpen, setVesselSidebarOpen] = useState(false)
  const [vesselSearch, setVesselSearch] = useState('')
  const [creatingVessel, setCreatingVessel] = useState(false)
  const [pendingVesselAssignment, setPendingVesselAssignment] = useState<{ vessel: Vessel; team: CrewManagerNode } | null>(null)
  const visibleDirectors = selectedDirectorId ? data.crewDirectors.filter((director) => director.id === selectedDirectorId) : data.crewDirectors
  const vesselsForPlacement = (manager: Parameters<typeof vesselBelongsToCrewManagerPlacement>[1]) => (
    data.vessels.filter((vessel) => vesselBelongsToCrewManagerPlacement(vessel, manager))
  )
  const normalizedVesselSearch = vesselSearch.trim().toLocaleLowerCase()
  const unassignedVessels = useMemo(
    () => data.vessels.filter((vessel) => !vessel.crewManagerId).sort((left, right) => left.name.localeCompare(right.name)),
    [data.vessels],
  )
  const vesselSearchResults = useMemo<VesselSearchResult[]>(() => {
    if (!normalizedVesselSearch) return []
    return data.vessels
      .filter((vessel) => vessel.name.toLocaleLowerCase().includes(normalizedVesselSearch))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((vessel) => {
        const vesselPlacement = getVesselPlacement(data, vessel)
        return {
          vessel,
          assigned: Boolean(vessel.crewManagerId && vesselPlacement),
          location: vesselPlacement
            ? `${vesselPlacement.crewManager.person.name} · ${vesselPlacement.deputyManager.person.name} · ${vesselPlacement.operationsManager.person.name}`
            : 'Unassigned',
        }
      })
  }, [data, normalizedVesselSearch])

  const updateVesselSearch = (value: string) => {
    setVesselSearch(value)
    const query = value.trim().toLocaleLowerCase()
    if (query && unassignedVessels.some((vessel) => vessel.name.toLocaleLowerCase().includes(query))) {
      setVesselSidebarOpen(true)
    }
  }

  const beginVesselAssignment = (vesselId: string, team: CrewManagerNode) => {
    const vessel = data.vessels.find((item) => item.id === vesselId)
    if (!canEdit || !vessel || vessel.crewManagerId) return
    setPendingVesselAssignment({ vessel, team })
  }

  const startDrag = (event: DragEvent, entity: DraggedHierarchyEntity) => {
    if (!canEdit) return
    event.stopPropagation()
    event.dataTransfer.effectAllowed = 'copyMove'
    event.dataTransfer.setData('text/plain', entity.entityId)
    setDragging(entity)
  }

  const allowDrop = (event: DragEvent, entityType: DraggedHierarchyEntity['entityType']) => {
    if (!canEdit || dragging?.entityType !== entityType) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
  }

  const dropOn = (
    event: DragEvent,
    entityType: DraggedHierarchyEntity['entityType'],
    parentId: string,
    parentName: string,
    parentLabel: string,
    parentPlacementId?: string,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    if (!dragging || dragging.entityType !== entityType || dragging.entityId === parentId) return
    setPlacement({ ...dragging, parentId, parentPlacementId, parentName, parentLabel })
    setDragging(null)
  }

  return (
    <div className="chart-view chart-view--compact-top org-chart">
      <ChartHeader title="Organization Chart" subtitle="Reporting structure only: Crew Director, Operations Manager, Deputy Manager and Crew Manager" />
      <OrgVesselSidebar
        open={vesselSidebarOpen}
        unassignedVessels={unassignedVessels}
        searchQuery={vesselSearch}
        searchResults={vesselSearchResults}
        canEdit={canEdit}
        onToggle={() => setVesselSidebarOpen((current) => !current)}
        onSearchChange={updateVesselSearch}
        onAddVessel={() => setCreatingVessel(true)}
      />
      <div className="chart-guidance chart-guidance--actions">
        <span>{canEdit ? 'Drag employees to change reporting lines, or open Unassigned vessels and drag a vessel onto a Crew Manager. ' : ''}Search above to locate any vessel in the hierarchy.</span>
        {canEdit ? <button type="button" className="hierarchy-root-add" onClick={() => setAdding({ target: { kind: 'crewDirector' }, role: 'CREW_DIRECTOR' })}><Plus size={14} /> Add Crew Director</button> : null}
      </div>

      {visibleDirectors.length ? (
        <div className="org-director-grid">
          {visibleDirectors.map((director) => {
            const directorOps = data.operationsManagers.filter((op) => op.crewDirectorId === director.id)

            return (
              <section
                className={`org-director-section ${dragging?.entityType === 'OPERATIONS_MANAGER' ? 'hierarchy-drop-ready' : ''}`}
                key={director.id}
                onDragOver={(event) => allowDrop(event, 'OPERATIONS_MANAGER')}
                onDrop={(event) => dropOn(event, 'OPERATIONS_MANAGER', director.id, director.person.name, 'Crew Director')}
              >
                <div className="director-row">
                  <div className="hierarchy-card-actions hierarchy-card-actions--director">
                    <PersonCard person={director.person} level="head" compact onEdit={canEdit ? () => setEditing({ target: { kind: 'crewDirector', id: director.id }, person: director.person, levelLabel: 'Crew Director' }) : undefined} />
                    {canEdit ? <button type="button" className="hierarchy-add-button" onClick={() => setAdding({ target: { kind: 'operationsManager', crewDirectorId: director.id }, role: 'OPERATIONS_MANAGER', parentName: director.person.name })} aria-label={`Add Crew Operations Manager under ${director.person.name}`} title="Add direct report"><Plus size={15} /></button> : null}
                  </div>
                </div>

                {directorOps.length ? (
                  <div className="org-operations-grid">
                    {directorOps.map((op) => {
                      const operationVesselCount = op.deputyManagers.reduce(
                        (operationTotal, deputy) => operationTotal + deputy.crewManagers.reduce(
                          (deputyTotal, manager) => deputyTotal + vesselsForPlacement(manager).length,
                          0,
                        ),
                        0,
                      )
                      return (
                      <section
                        className={`org-operations-section ${dragging?.entityType === 'DEPUTY_MANAGER' ? 'hierarchy-drop-ready' : ''} ${dragging?.entityId === op.id ? 'hierarchy-dragging' : ''}`}
                        key={op.reportingLineId || op.id}
                        draggable={canEdit}
                        onDragStart={(event) => startDrag(event, { entityType: 'OPERATIONS_MANAGER', entityId: op.id, entityName: op.person.name, entityLabel: 'Crew Operations Manager' })}
                        onDragEnd={() => setDragging(null)}
                        onDragOver={(event) => allowDrop(event, 'DEPUTY_MANAGER')}
                        onDrop={(event) => dropOn(event, 'DEPUTY_MANAGER', op.id, op.person.name, 'Crew Operations Manager', op.reportingLineId)}
                      >
                        <div className="operations-heading" title={canEdit ? 'Drag this Operations Manager to another Crew Director' : undefined}>
                          {canEdit ? <GripVertical className="hierarchy-drag-grip" size={15} aria-hidden="true" /> : null}
                          <div>
                            <strong>{op.person.name}</strong>
                            <span>{op.person.designation}</span>
                          </div>
                          <b>{operationVesselCount ? `${operationVesselCount} VSLS` : `${op.deputyManagers.length} deputies`}</b>
                          {canEdit ? <div className="hierarchy-heading-actions">
                            <button type="button" className="chart-inline-edit" onClick={() => setEditing({ target: { kind: 'operationsManager', id: op.id }, person: op.person, levelLabel: 'Crew Operations Manager' })} aria-label={`Edit ${op.person.name}`}><Pencil size={12} /></button>
                            <button type="button" className="hierarchy-add-button" onClick={() => setAdding({ target: { kind: 'deputyManager', operationsManagerId: op.id, ...(op.reportingLineId ? { operationsManagerReportingLineId: op.reportingLineId } : {}) }, role: 'DEPUTY_MANAGER', parentName: op.person.name })} aria-label={`Add Deputy Manager under ${op.person.name}`} title="Add direct report"><Plus size={14} /></button>
                          </div> : null}
                        </div>

                        <div className="org-deputy-grid">
                          {op.deputyManagers.length ? op.deputyManagers.map((deputy) => {
                            const deputyVesselCount = deputy.crewManagers.reduce(
                              (total, manager) => total + vesselsForPlacement(manager).length,
                              0,
                            )
                            return (
                            <section
                              className={`org-deputy-section ${dragging?.entityType === 'CREW_MANAGER' ? 'hierarchy-drop-ready' : ''} ${dragging?.entityId === deputy.id ? 'hierarchy-dragging' : ''}`}
                              key={deputy.reportingLineId || deputy.id}
                              draggable={canEdit}
                              onDragStart={(event) => startDrag(event, { entityType: 'DEPUTY_MANAGER', entityId: deputy.id, entityName: deputy.person.name, entityLabel: 'Deputy Manager' })}
                              onDragEnd={() => setDragging(null)}
                              onDragOver={(event) => allowDrop(event, 'CREW_MANAGER')}
                              onDrop={(event) => dropOn(event, 'CREW_MANAGER', deputy.id, deputy.person.name, 'Deputy Manager', deputy.reportingLineId)}
                            >
                              <div className="deputy-heading" title={canEdit ? 'Drag this Deputy Manager to another Operations Manager' : undefined}>
                                {canEdit ? <GripVertical className="hierarchy-drag-grip" size={14} aria-hidden="true" /> : null}
                                <strong>{deputy.person.name}</strong>
                                <span>{deputy.person.designation || 'Deputy Crew Manager'}</span>
                                <b>{deputyVesselCount ? `${deputyVesselCount} VSLS` : `${deputy.crewManagers.length} crew managers`}</b>
                                {canEdit ? <div className="hierarchy-heading-actions">
                                  <button type="button" className="chart-inline-edit" onClick={() => setEditing({ target: { kind: 'deputyManager', id: deputy.id, operationsManagerId: op.id }, person: deputy.person, levelLabel: 'Deputy Manager' })} aria-label={`Edit ${deputy.person.name}`}><Pencil size={12} /></button>
                                  <button type="button" className="hierarchy-add-button" onClick={() => setAdding({ target: { kind: 'crewManager', deputyManagerId: deputy.id, ...(deputy.reportingLineId ? { deputyManagerReportingLineId: deputy.reportingLineId } : {}) }, role: 'CREW_MANAGER', parentName: deputy.person.name })} aria-label={`Add Crew Manager under ${deputy.person.name}`} title="Add direct report"><Plus size={14} /></button>
                                </div> : null}
                              </div>
                              <div className="org-crew-manager-grid layout-many">
                                {deputy.crewManagers.length ? deputy.crewManagers.map((cm) => (
                                  <div
                                    key={cm.reportingLineId || cm.id}
                                    className={`hierarchy-draggable-card ${dragging?.entityId === cm.id ? 'hierarchy-dragging' : ''}`}
                                    draggable={canEdit}
                                    onDragStart={(event) => startDrag(event, { entityType: 'CREW_MANAGER', entityId: cm.id, entityName: cm.person.name, entityLabel: 'Crew Manager' })}
                                    onDragEnd={() => setDragging(null)}
                                    title={canEdit ? 'Drag this Crew Manager to another Deputy Manager' : undefined}
                                  >
                                    {canEdit ? <GripVertical className="hierarchy-card-grip" size={14} aria-hidden="true" /> : null}
                                    <TeamCard
                                      team={cm}
                                      vessels={vesselsForPlacement(cm)}
                                      highlightedVessels={normalizedVesselSearch ? vesselsForPlacement(cm).filter((vessel) => vessel.name.toLocaleLowerCase().includes(normalizedVesselSearch)) : []}
                                      compact
                                      showVessels={false}
                                      showVesselCountTooltip
                                      onVesselDrop={canEdit ? (vesselId) => beginVesselAssignment(vesselId, cm) : undefined}
                                      onEdit={canEdit ? () => setEditing({ target: { kind: 'crewManager', id: cm.id, deputyManagerId: deputy.id }, person: cm.person, levelLabel: 'Crew Manager' }) : undefined}
                                    />
                                  </div>
                                )) : (
                                  <div className="chart-empty-state">
                                    <strong>No Crew Managers assigned yet</strong>
                                    <span>Add a Crew Manager below this Deputy Manager.</span>
                                  </div>
                                )}
                              </div>
                            </section>
                            )
                          }) : (
                            <div className="chart-empty-state">
                              <strong>No Deputy Managers assigned yet</strong>
                              <span>Add a Deputy Manager before adding Crew Managers.</span>
                            </div>
                          )}
                        </div>
                      </section>
                      )
                    })}
                  </div>
                ) : (
                  <div className="chart-empty-state">
                    <strong>No Crew Operations Managers found under this Crew Director.</strong>
                    <span>Add a Crew Operations Manager to continue building this chart.</span>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      ) : (
        <div className="chart-empty-state">
          <strong>No Crew Directors found.</strong>
          <span>Add a Crew Director to begin building the organization chart.</span>
        </div>
      )}

      <footer className="chart-footer">
        <span>{data.footerText}</span>
        <span>{visibleDirectors.length} crew directors · {data.operationsManagers.length} crew operations managers</span>
      </footer>
      {editing ? <InlinePersonEditor person={editing.person} levelLabel={editing.levelLabel} onClose={() => setEditing(null)} onSave={(person) => saveHierarchyPerson(editing.target, person)} /> : null}
      {adding ? <HierarchyPersonDialog target={adding.target} role={adding.role} parentName={adding.parentName} onClose={() => setAdding(null)} /> : null}
      {placement ? (
        <HierarchyPlacementDialog
          placement={placement}
          onClose={() => setPlacement(null)}
          onConfirm={(action) => updateHierarchyPlacement({
            entityType: placement.entityType,
            entityId: placement.entityId,
            parentId: placement.parentId,
            ...(placement.parentPlacementId ? { parentPlacementId: placement.parentPlacementId } : {}),
            action,
          })}
        />
      ) : null}
      {pendingVesselAssignment ? (
        <VesselAllocationDialog
          mode="reassign"
          team={pendingVesselAssignment.team}
          vessel={pendingVesselAssignment.vessel}
          vessels={data.vessels}
          onClose={() => setPendingVesselAssignment(null)}
          onAssign={(vesselId) => assignVesselFromChart(
            vesselId,
            pendingVesselAssignment.team.id,
            pendingVesselAssignment.team.reportingLineId,
          )}
          onSave={async () => undefined}
          onUnassign={async () => undefined}
        />
      ) : null}
      {creatingVessel ? <VesselCreateDialog onClose={() => setCreatingVessel(false)} /> : null}
    </div>
  )
}
