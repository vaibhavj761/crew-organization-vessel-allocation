import type { ChartData, Vessel } from '../types'
import { getAllCrewManagers, getCrewManagerPlacements } from '../utils/operationsAllocation'

export function VesselAssignmentFields({
  data,
  vessel,
  onChange,
  disabled = false,
  showErrors = false,
  compact = false,
}: {
  data: ChartData
  vessel: Vessel
  onChange: (patch: Partial<Vessel>) => void
  disabled?: boolean
  showErrors?: boolean
  compact?: boolean
}) {
  const crewManagers = getAllCrewManagers(data)
  const placements = vessel.crewManagerId ? getCrewManagerPlacements(data, vessel.crewManagerId) : []
  const deputyOptions = Array.from(new Map(
    placements.map((placement) => [placement.deputyManager.id, placement.deputyManager]),
  ).values())
  const operationPlacements = placements.filter((placement) => placement.deputyManager.id === vessel.deputyManagerId)
  const operationsOptions = Array.from(new Map(
    operationPlacements.map((placement) => [placement.operationsManager.id, placement.operationsManager]),
  ).values())

  const selectCrewManager = (crewManagerId: string) => {
    if (!crewManagerId) {
      onChange({ crewManagerId: '', crewManagerReportingLineId: '', deputyManagerId: '', operationsManagerId: '', assignedAssistantId: '' })
      return
    }
    const available = getCrewManagerPlacements(data, crewManagerId)
    const preferred = available.find((placement) => placement.crewManager.isPrimaryReportingLine) || available[0]
    onChange({
      crewManagerId,
      crewManagerReportingLineId: preferred?.crewManager.reportingLineId || '',
      deputyManagerId: preferred?.deputyManager.id || '',
      operationsManagerId: preferred?.operationsManager.id || '',
      assignedAssistantId: '',
    })
  }

  const selectDeputy = (deputyManagerId: string) => {
    const available = placements.filter((placement) => placement.deputyManager.id === deputyManagerId)
    const preferred = available.find((placement) => placement.crewManager.isPrimaryReportingLine) || available[0]
    onChange({
      deputyManagerId,
      operationsManagerId: preferred?.operationsManager.id || '',
      crewManagerReportingLineId: preferred?.crewManager.reportingLineId || '',
    })
  }

  const selectOperationsManager = (operationsManagerId: string) => {
    const selected = operationPlacements.find((placement) => placement.operationsManager.id === operationsManagerId)
    onChange({ operationsManagerId, crewManagerReportingLineId: selected?.crewManager.reportingLineId || '' })
  }

  const missingCrewManager = showErrors && !vessel.crewManagerId.trim()
  const missingDeputy = showErrors && Boolean(vessel.crewManagerId) && !vessel.deputyManagerId?.trim()
  const missingOperations = showErrors && Boolean(vessel.deputyManagerId) && !vessel.operationsManagerId?.trim()

  return (
    <div className={`vessel-assignment-fields${compact ? ' vessel-assignment-fields--compact' : ''}`}>
      <label>
        Crew Manager <span aria-hidden="true">*</span>
        <select value={vessel.crewManagerId} onChange={(event) => selectCrewManager(event.target.value)} disabled={disabled} aria-invalid={missingCrewManager}>
          <option value="">Select Crew Manager</option>
          {crewManagers.map((manager) => <option key={manager.id} value={manager.id}>{manager.person.name}</option>)}
        </select>
        {missingCrewManager ? <small className="field-error">Assignment is required.</small> : null}
      </label>
      <label>
        Crew Operations Manager <span aria-hidden="true">*</span>
        <select value={vessel.deputyManagerId || ''} onChange={(event) => selectDeputy(event.target.value)} disabled={disabled || !vessel.crewManagerId} aria-invalid={missingDeputy}>
          <option value="">Select Crew Operations Manager</option>
          {deputyOptions.map((manager) => <option key={manager.id} value={manager.id}>{manager.person.name}</option>)}
        </select>
        {missingDeputy ? <small className="field-error">Crew Operations Manager is required.</small> : null}
      </label>
      <label>
        General Manager <span aria-hidden="true">*</span>
        <select value={vessel.operationsManagerId || ''} onChange={(event) => selectOperationsManager(event.target.value)} disabled={disabled || !vessel.deputyManagerId} aria-invalid={missingOperations}>
          <option value="">Select General Manager</option>
          {operationsOptions.map((manager) => <option key={manager.id} value={manager.id}>{manager.person.name}</option>)}
        </select>
        {missingOperations ? <small className="field-error">General Manager is required.</small> : null}
      </label>
    </div>
  )
}
