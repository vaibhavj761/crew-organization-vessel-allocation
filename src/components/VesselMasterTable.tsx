/* eslint-disable react-hooks/exhaustive-deps */
import { FileSpreadsheet, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useChart } from '../state/ChartContext'
import type { Vessel, VesselFilters } from '../types'
import { getAllCrewManagers, getCrewManagerReportingContext, getManagementChainForOperationsManager, getVesselPlacement } from '../utils/operationsAllocation'
import { downloadVesselMasterCsv } from '../utils/exportVesselsCsv'
import { validateVesselMasterFields } from '../utils/vesselValidation'
import { VesselCreateDialog } from './VesselCreateDialog'
import { VesselAssignmentFields } from './VesselAssignmentFields'


interface OperationsFilterContext { id: string; crewManagerIds: string[]; managementPositionIds?: string[] }

export function filterVessels(vessels: Vessel[], filters: VesselFilters, operationsManagers: OperationsFilterContext[]) {
  const matchingOperations = operationsManagers.filter((item) => !filters.managementPositionId || item.managementPositionIds?.includes(filters.managementPositionId))
  const selectedOperations = filters.operationsManagerId
    ? matchingOperations.filter((item) => item.id === filters.operationsManagerId)
    : matchingOperations
  const operationsManagerIds = filters.managementPositionId || filters.operationsManagerId
    ? new Set(selectedOperations.map((item) => item.id))
    : null
  const crewManagerIds = operationsManagerIds
    ? new Set(selectedOperations.flatMap((item) => item.crewManagerIds))
    : null
  const query = filters.search.toLowerCase()
  return vessels.filter((vessel) => {
    const matchesQuery = !query || [vessel.name, vessel.ownerName, vessel.ownerPool, vessel.vesselDoc, vessel.vesselManager].some((value) => value.toLowerCase().includes(query))
    return matchesQuery
      && (!crewManagerIds || (vessel.operationsManagerId
        ? operationsManagerIds?.has(vessel.operationsManagerId)
        : crewManagerIds.has(vessel.crewManagerId)))
      && (!filters.crewManagerId || vessel.crewManagerId === filters.crewManagerId)
      && (!filters.vesselStatus || vessel.vesselStatus === filters.vesselStatus)
      && (!filters.managementType || vessel.managementType === filters.managementType)
  })
}

export function VesselMasterTable({ canEdit = true, canExport = true }: { canEdit?: boolean; canExport?: boolean }) {
  const { data, loadState } = useChart()
  const [filters, setFilters] = useState<VesselFilters>({ search: '', managementPositionId: '', operationsManagerId: '', crewManagerId: '', vesselStatus: '', managementType: '' })
  const [editing, setEditing] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const crewManagers = getAllCrewManagers(data)
  const operationsManagers = data.operationsManagers.map((op) => ({
    id: op.id,
    managementPositionIds: getManagementChainForOperationsManager(data, op).map((position) => position.id),
    // A shared Crew Manager may report through several branches, but their
    // vessels belong to exactly one allocation-owning (primary) placement.
    crewManagerIds: op.deputyManagers.flatMap((deputy) => deputy.crewManagers
      .filter((crewManager) => crewManager.isPrimaryReportingLine !== false)
      .map((crewManager) => crewManager.id)),
  }))
  const rows = useMemo(() => filterVessels(data.vessels, filters, operationsManagers), [data, filters])
  const managementPositions = data.crewDirectors.flatMap((director) => director.managementPositions || [])
  const visibleOperationsManagers = data.operationsManagers.filter((op) => {
    if (!filters.managementPositionId) return true
    return getManagementChainForOperationsManager(data, op).some((position) => position.id === filters.managementPositionId)
  })

  return (
    <div className="vessel-master">
      <div className="master-heading">
        <div>
          <h2>Vessel Master List</h2>
          <p>{rows.length} of {data.vessels.length} vessels</p>
        </div>
        <div className="master-actions">
          {canExport ? <button type="button" className="button secondary" onClick={() => downloadVesselMasterCsv(data, rows)} disabled={loadState !== 'ready' || !rows.length} title="Download the current filtered vessel list for Excel"><FileSpreadsheet size={14} /> Export Excel</button> : null}
          {canEdit ? <button type="button" className="button" onClick={() => { setError(''); setCreating(true) }} disabled={loadState !== 'ready'}><Plus size={14} /> Add vessel</button> : null}
        </div>
      </div>
      {canEdit ? <p className="helper-copy">Required fields: Vessel name, Vessel type, Assignment.</p> : null}

      <div className="vessel-filters">
        <label className="search-field">
          <Search size={14} />
          <input placeholder="Search vessel, owner, pool, DOC or manager" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        </label>
        <select aria-label="Filter by Head or management level" value={filters.managementPositionId} onChange={(e) => setFilters({ ...filters, managementPositionId: e.target.value, operationsManagerId: '', crewManagerId: '' })}>
          <option value="">All Heads / Management Levels</option>
          {managementPositions.map((position) => <option key={position.id} value={position.id}>{position.levelName} — {position.person.name}</option>)}
        </select>
        <select value={filters.operationsManagerId} onChange={(e) => setFilters({ ...filters, operationsManagerId: e.target.value, crewManagerId: '' })}>
          <option value="">All Operations Managers</option>
          {visibleOperationsManagers.map((op) => <option key={op.id} value={op.id}>{op.person.name}</option>)}
        </select>
        <select value={filters.crewManagerId} onChange={(e) => setFilters({ ...filters, crewManagerId: e.target.value })}>
          <option value="">All Crew Managers</option>
          {crewManagers.filter((cm) => {
            if (filters.operationsManagerId) return operationsManagers.find((item) => item.id === filters.operationsManagerId)?.crewManagerIds.includes(cm.id)
            if (filters.managementPositionId) return visibleOperationsManagers.some((op) => operationsManagers.find((item) => item.id === op.id)?.crewManagerIds.includes(cm.id))
            return true
          }).map((cm) => (
            <option key={cm.id} value={cm.id}>{cm.person.name}{getCrewManagerReportingContext(data, cm.id) ? ` — ${getCrewManagerReportingContext(data, cm.id)}` : ''}</option>
          ))}
        </select>
        <select value={filters.vesselStatus} onChange={(e) => setFilters({ ...filters, vesselStatus: e.target.value as VesselFilters['vesselStatus'] })}>
          <option value="">All statuses</option>
          <option value="IN_MANAGEMENT">IN_MANAGEMENT</option>
          <option value="UPCOMING">UPCOMING</option>
          <option value="OUT_OF_MANAGEMENT">OUT_OF_MANAGEMENT</option>
        </select>
        <select value={filters.managementType} onChange={(e) => setFilters({ ...filters, managementType: e.target.value as VesselFilters['managementType'] })}>
          <option value="">All management types</option>
          <option value="FULL_MANAGED">FULL_MANAGED</option>
          <option value="CREW_MANAGED">CREW_MANAGED</option>
        </select>
      </div>

      <div className="filter-summary" aria-live="polite">
        <span>{rows.length} matching vessel{rows.length === 1 ? '' : 's'}</span>
        {(filters.search || filters.managementPositionId || filters.operationsManagerId || filters.crewManagerId || filters.vesselStatus || filters.managementType) ? <button type="button" className="button ghost" onClick={() => setFilters({ search: '', managementPositionId: '', operationsManagerId: '', crewManagerId: '', vesselStatus: '', managementType: '' })}>Clear filters</button> : null}
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="vessel-table-wrap">
        <table className="vessel-table">
          <thead>
            <tr>
              <th>Vessel</th>
              <th>Type / DOC</th>
              <th>Owner</th>
              <th>Assignment</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((vessel) => (
              <VesselRow key={vessel.id} vessel={vessel} editing={editing === vessel.id} setEditing={setEditing} canEdit={canEdit} />
            ))}
            {!rows.length ? <tr className="table-empty-row"><td colSpan={6}><strong>No vessels match these filters</strong><small>Adjust the search or filters to view other Vessel Master records.</small></td></tr> : null}
          </tbody>
        </table>
      </div>
      {creating ? <VesselCreateDialog onClose={() => setCreating(false)} /> : null}
    </div>
  )
}

function VesselRow({ vessel, editing, setEditing, canEdit }: { vessel: Vessel; editing: boolean; setEditing: (id: string) => void; canEdit: boolean }) {
  const { data, dispatch } = useChart()
  const crewManagers = getAllCrewManagers(data)
  const crewManager = crewManagers.find((item) => item.id === vessel.crewManagerId)
  const placement = getVesselPlacement(data, vessel)
  const update = (patch: Partial<Vessel>) => dispatch({ type: 'updateVessel', value: { ...vessel, ...patch } })
  const validationErrors = editing ? validateVesselMasterFields(vessel) : { name: '', vesselType: '', assignment: '' }
  const assignmentPathMissing = Boolean(vessel.crewManagerId)
    && (!vessel.crewManagerReportingLineId || !vessel.deputyManagerId || !vessel.operationsManagerId)

  if (!editing) {
    return (
      <tr onDoubleClick={() => setEditing(vessel.id)}>
        <td><strong>{vessel.name}</strong><small>{vessel.deadweightTonnage && `${vessel.deadweightTonnage} DWT`}</small></td>
        <td>{vessel.vesselType || 'Type not set'}<small>{vessel.vesselDoc || 'DOC not provided'}</small></td>
        <td>{vessel.ownerName || vessel.ownerPool || 'Owner not provided'}<small>{vessel.vesselManager || 'Manager not provided'}</small></td>
        <td>{crewManager?.person.name || 'Unassigned'}<small>{placement ? `${placement.deputyManager.person.name} · ${placement.operationsManager.person.name}` : 'Reporting path not selected'}</small></td>
        <td><span className={`table-status table-status--${vessel.vesselStatus.toLowerCase()}`}>{vessel.vesselStatus.replaceAll('_', ' ')}</span><small className="management-label">{vessel.managementType.replaceAll('_', ' ')}</small></td>
        <td>{canEdit ? <>
          <button type="button" className="mini-add" onClick={() => setEditing(vessel.id)}>Edit</button>
          <button type="button" className="tiny-icon danger-text" onClick={() => confirm('Delete this vessel?') && dispatch({ type: 'deleteVessel', id: vessel.id })}><Trash2 size={13} /></button>
        </> : null}</td>
      </tr>
    )
  }

  return (
    <tr className="editing-row">
      <td>
        <input aria-invalid={Boolean(validationErrors.name)} placeholder="Vessel name *" value={vessel.name} onChange={(e) => update({ name: e.target.value })} />
        {validationErrors.name ? <small className="field-error">{validationErrors.name}</small> : null}
        <input placeholder="DWT" value={vessel.deadweightTonnage} onChange={(e) => update({ deadweightTonnage: e.target.value })} />
      </td>
      <td>
        <input aria-invalid={Boolean(validationErrors.vesselType)} placeholder="Vessel type *" value={vessel.vesselType} onChange={(e) => update({ vesselType: e.target.value })} />
        {validationErrors.vesselType ? <small className="field-error">{validationErrors.vesselType}</small> : null}
        <input placeholder="DOC" value={vessel.vesselDoc} onChange={(e) => update({ vesselDoc: e.target.value })} />
      </td>
      <td><input placeholder="Owner name" value={vessel.ownerName} onChange={(e) => update({ ownerName: e.target.value })} /><input placeholder="Owner pool" value={vessel.ownerPool} onChange={(e) => update({ ownerPool: e.target.value })} /><input placeholder="Vessel manager" value={vessel.vesselManager} onChange={(e) => update({ vesselManager: e.target.value })} /></td>
      <td>
        <VesselAssignmentFields data={data} vessel={vessel} onChange={update} showErrors compact />
      </td>
      <td>
        <select value={vessel.vesselStatus} onChange={(e) => update({ vesselStatus: e.target.value as Vessel['vesselStatus'] })}>
          <option value="IN_MANAGEMENT">IN_MANAGEMENT</option>
          <option value="UPCOMING">UPCOMING</option>
          <option value="OUT_OF_MANAGEMENT">OUT_OF_MANAGEMENT</option>
        </select>
        <select value={vessel.managementType} onChange={(e) => update({ managementType: e.target.value as Vessel['managementType'] })}>
          <option value="FULL_MANAGED">FULL_MANAGED</option>
          <option value="CREW_MANAGED">CREW_MANAGED</option>
        </select>
      </td>
      <td><button type="button" className="button" onClick={() => setEditing('')} disabled={Boolean(validationErrors.name || validationErrors.vesselType || validationErrors.assignment || assignmentPathMissing)} title={validationErrors.name || validationErrors.vesselType || validationErrors.assignment || (assignmentPathMissing ? 'Select the complete reporting path.' : undefined)}>Finish editing</button></td>
    </tr>
  )
}
