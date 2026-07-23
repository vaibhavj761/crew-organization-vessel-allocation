/* eslint-disable react-hooks/exhaustive-deps */
import { Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useChart } from '../state/ChartContext'
import type { Vessel, VesselFilters } from '../types'
import { getAllCrewManagers, getCrewManagerReportingContext, getVesselPlacement } from '../utils/operationsAllocation'
import { validateVesselMasterFields } from '../utils/vesselValidation'
import { VesselCreateDialog } from './VesselCreateDialog'
import { VesselAssignmentFields } from './VesselAssignmentFields'


export function filterVessels(vessels: Vessel[], filters: VesselFilters, operationsManagers: { id: string; crewManagerIds: string[] }[]) {
  const crewManagerIds = filters.operationsManagerId
    ? new Set(operationsManagers.find((item) => item.id === filters.operationsManagerId)?.crewManagerIds)
    : null
  const query = filters.search.toLowerCase()
  return vessels.filter((vessel) => {
    const matchesQuery = !query || [vessel.name, vessel.ownerName, vessel.ownerPool, vessel.vesselDoc, vessel.vesselManager].some((value) => value.toLowerCase().includes(query))
    return matchesQuery
      && (!crewManagerIds || (vessel.operationsManagerId
        ? vessel.operationsManagerId === filters.operationsManagerId
        : crewManagerIds.has(vessel.crewManagerId)))
      && (!filters.crewManagerId || vessel.crewManagerId === filters.crewManagerId)
      && (!filters.vesselStatus || vessel.vesselStatus === filters.vesselStatus)
      && (!filters.managementType || vessel.managementType === filters.managementType)
  })
}

export function VesselMasterTable({ canEdit = true }: { canEdit?: boolean }) {
  const { data, loadState } = useChart()
  const [filters, setFilters] = useState<VesselFilters>({ search: '', operationsManagerId: '', crewManagerId: '', vesselStatus: '', managementType: '' })
  const [editing, setEditing] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const crewManagers = getAllCrewManagers(data)
  const operationsManagers = data.operationsManagers.map((op) => ({
    id: op.id,
    // A shared Crew Manager may report through several branches, but their
    // vessels belong to exactly one allocation-owning (primary) placement.
    crewManagerIds: op.deputyManagers.flatMap((deputy) => deputy.crewManagers
      .filter((crewManager) => crewManager.isPrimaryReportingLine !== false)
      .map((crewManager) => crewManager.id)),
  }))
  const rows = useMemo(() => filterVessels(data.vessels, filters, operationsManagers), [data.vessels, filters])

  return (
    <div className="vessel-master">
      <div className="master-heading">
        <div>
          <h2>Vessel Master List</h2>
          <p>{rows.length} of {data.vessels.length} vessels</p>
        </div>
        {canEdit ? <button type="button" className="button" onClick={() => { setError(''); setCreating(true) }} disabled={loadState !== 'ready'}><Plus size={14} /> Add vessel</button> : null}
      </div>
      {canEdit ? <p className="helper-copy">Required fields: Vessel name, Vessel type, Assignment.</p> : null}

      <div className="vessel-filters">
        <label className="search-field">
          <Search size={14} />
          <input placeholder="Search vessel, owner, pool, DOC or manager" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        </label>
        <select value={filters.operationsManagerId} onChange={(e) => setFilters({ ...filters, operationsManagerId: e.target.value, crewManagerId: '' })}>
          <option value="">All Operations Managers</option>
          {data.operationsManagers.map((op) => <option key={op.id} value={op.id}>{op.person.name}</option>)}
        </select>
        <select value={filters.crewManagerId} onChange={(e) => setFilters({ ...filters, crewManagerId: e.target.value })}>
          <option value="">All Crew Managers</option>
          {crewManagers.filter((cm) => !filters.operationsManagerId || operationsManagers.find((item) => item.id === filters.operationsManagerId)?.crewManagerIds.includes(cm.id)).map((cm) => (
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
        {(filters.search || filters.operationsManagerId || filters.crewManagerId || filters.vesselStatus || filters.managementType) ? <button type="button" className="button ghost" onClick={() => setFilters({ search: '', operationsManagerId: '', crewManagerId: '', vesselStatus: '', managementType: '' })}>Clear filters</button> : null}
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
