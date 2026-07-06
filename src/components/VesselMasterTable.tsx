/* eslint-disable react-hooks/exhaustive-deps */
import { Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useChart } from '../state/ChartContext'
import type { Vessel, VesselFilters } from '../types'
import { createId } from '../utils/createId'

const id = () => createId()

export function filterVessels(vessels: Vessel[], filters: VesselFilters, operationsManagers: { id: string; crewManagerIds: string[] }[]) {
  const crewManagerIds = filters.operationsManagerId
    ? new Set(operationsManagers.find((item) => item.id === filters.operationsManagerId)?.crewManagerIds)
    : null
  const query = filters.search.toLowerCase()
  return vessels.filter((vessel) => {
    const matchesQuery = !query || [vessel.name, vessel.ownerName, vessel.ownerPool, vessel.vesselDoc, vessel.vesselManager].some((value) => value.toLowerCase().includes(query))
    return matchesQuery
      && (!crewManagerIds || crewManagerIds.has(vessel.crewManagerId))
      && (!filters.crewManagerId || vessel.crewManagerId === filters.crewManagerId)
      && (!filters.vesselStatus || vessel.vesselStatus === filters.vesselStatus)
      && (!filters.managementType || vessel.managementType === filters.managementType)
  })
}

export function VesselMasterTable({ canEdit = true }: { canEdit?: boolean }) {
  const { data, dispatch, loadState } = useChart()
  const [filters, setFilters] = useState<VesselFilters>({ search: '', operationsManagerId: '', crewManagerId: '', vesselStatus: '', managementType: '' })
  const [editing, setEditing] = useState('')
  const [error, setError] = useState('')
  const crewManagers = data.operationsManagers.flatMap((op) => op.crewManagers)
  const operationsManagers = data.operationsManagers.map((op) => ({ id: op.id, crewManagerIds: op.crewManagers.map((cm) => cm.id) }))
  const rows = useMemo(() => filterVessels(data.vessels, filters, operationsManagers), [data.vessels, filters])

  const addVessel = () => {
    if (loadState !== 'ready') return
    setError('')
    try {
      const value: Vessel = {
        id: id(),
        name: 'New Vessel',
        vesselType: '',
        vesselDoc: '',
        deadweightTonnage: '',
        ownerPool: '',
        ownerName: '',
        vesselManager: '',
        crewManagerId: '',
        assignedAssistantId: '',
        vesselStatus: 'UPCOMING',
        managementType: 'FULL_MANAGED',
        notes: '',
        sortOrder: data.vessels.length + 1,
      }
      dispatch({ type: 'addVessel', value })
      setEditing(value.id)
    } catch {
      setError('Vessel could not be added. Please try again.')
    }
  }

  return (
    <div className="vessel-master">
      <div className="master-heading">
        <div>
          <h2>Vessel Master List</h2>
          <p>{rows.length} of {data.vessels.length} vessels</p>
        </div>
        {canEdit ? <button type="button" className="button" onClick={addVessel} disabled={loadState !== 'ready'}><Plus size={14} /> Add vessel</button> : null}
      </div>

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
            <option key={cm.id} value={cm.id}>{cm.person.name}</option>
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
          </tbody>
        </table>
      </div>
    </div>
  )
}

function VesselRow({ vessel, editing, setEditing, canEdit }: { vessel: Vessel; editing: boolean; setEditing: (id: string) => void; canEdit: boolean }) {
  const { data, dispatch } = useChart()
  const crewManagers = data.operationsManagers.flatMap((op) => op.crewManagers)
  const crewManager = crewManagers.find((item) => item.id === vessel.crewManagerId)
  const update = (patch: Partial<Vessel>) => dispatch({ type: 'updateVessel', value: { ...vessel, ...patch } })

  if (!editing) {
    return (
      <tr onDoubleClick={() => setEditing(vessel.id)}>
        <td><strong>{vessel.name}</strong><small>{vessel.deadweightTonnage && `${vessel.deadweightTonnage} DWT`}</small></td>
        <td>{vessel.vesselType}<small>{vessel.vesselDoc}</small></td>
        <td>{vessel.ownerName || vessel.ownerPool}<small>{vessel.vesselManager}</small></td>
        <td>{crewManager?.person.name || 'Unassigned'}<small>{crewManager?.assistants.find((assistant) => assistant.id === vessel.assignedAssistantId)?.name}</small></td>
        <td><span className="table-status">{vessel.vesselStatus.replaceAll('_', ' ')}</span><small>{vessel.managementType.replaceAll('_', ' ')}</small></td>
        <td>{canEdit ? <>
          <button type="button" className="mini-add" onClick={() => setEditing(vessel.id)}>Edit</button>
          <button type="button" className="tiny-icon danger-text" onClick={() => confirm('Delete this vessel?') && dispatch({ type: 'deleteVessel', id: vessel.id })}><Trash2 size={13} /></button>
        </> : null}</td>
      </tr>
    )
  }

  return (
    <tr className="editing-row">
      <td><input value={vessel.name} onChange={(e) => update({ name: e.target.value })} /><input placeholder="DWT" value={vessel.deadweightTonnage} onChange={(e) => update({ deadweightTonnage: e.target.value })} /></td>
      <td><input placeholder="Type" value={vessel.vesselType} onChange={(e) => update({ vesselType: e.target.value })} /><input placeholder="DOC" value={vessel.vesselDoc} onChange={(e) => update({ vesselDoc: e.target.value })} /></td>
      <td><input placeholder="Owner name" value={vessel.ownerName} onChange={(e) => update({ ownerName: e.target.value })} /><input placeholder="Owner pool" value={vessel.ownerPool} onChange={(e) => update({ ownerPool: e.target.value })} /><input placeholder="Vessel manager" value={vessel.vesselManager} onChange={(e) => update({ vesselManager: e.target.value })} /></td>
      <td>
        <select value={vessel.crewManagerId} onChange={(e) => update({ crewManagerId: e.target.value, assignedAssistantId: '' })}>
          <option value="">Unassigned</option>
          {crewManagers.map((cm) => <option key={cm.id} value={cm.id}>{cm.person.name}</option>)}
        </select>
        <select value={vessel.assignedAssistantId} onChange={(e) => update({ assignedAssistantId: e.target.value })}>
          <option value="">Team responsibility</option>
          {crewManager?.assistants.map((assistant) => <option key={assistant.id} value={assistant.id}>{assistant.name}</option>)}
        </select>
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
      <td><button type="button" className="button" onClick={() => setEditing('')}>Done</button></td>
    </tr>
  )
}
