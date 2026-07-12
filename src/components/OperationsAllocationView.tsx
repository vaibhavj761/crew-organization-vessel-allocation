import { useMemo } from 'react'
import { useChart } from '../state/ChartContext'
import { getCrewManagerLayoutMode } from '../utils/chartLayout'
import { getCrewManagersForOperationsManager } from '../utils/operationsAllocation'
import { ChartHeader } from './ChartHeader'
import { PersonCard } from './PersonCard'
import { TeamCard } from './TeamCard'

export function OperationsAllocationView({
  crewDirectorId,
  operationsManagerId,
  crewManagerId,
}: {
  crewDirectorId: string
  operationsManagerId: string
  crewManagerId: string
}) {
  const { data } = useChart()

  const director = useMemo(
    () => data.crewDirectors.find((item) => item.id === crewDirectorId),
    [crewDirectorId, data.crewDirectors],
  )

  const operationsManagers = useMemo(
    () => data.operationsManagers.filter((item) => item.crewDirectorId === crewDirectorId),
    [crewDirectorId, data.operationsManagers],
  )

  const operationsManager = useMemo(
    () => operationsManagers.find((item) => item.id === operationsManagerId) || (!operationsManagerId ? operationsManagers[0] : undefined),
    [operationsManagerId, operationsManagers],
  )

  const visibleCrewManagers = useMemo(
    () => getCrewManagersForOperationsManager(operationsManager, crewManagerId),
    [crewManagerId, operationsManager],
  )
  const visibleVesselCount = useMemo(
    () => visibleCrewManagers.reduce((total, team) => total + data.vessels.filter((item) => item.crewManagerId === team.id || item.crewManagerId === team.person.id).length, 0),
    [data.vessels, visibleCrewManagers],
  )
  const layoutMode = getCrewManagerLayoutMode(visibleCrewManagers.length)

  if (!crewDirectorId) {
    return (
      <div className="chart-view chart-view--compact-top operations-allocation-view">
        <ChartHeader
          title="Operations & Vessel Allocation"
          subtitle="Select a Crew Director to view the team structure."
        />
        <div className="chart-empty-state">
          <strong>Select a Crew Director to view the team structure.</strong>
          <span>Then choose a Crew Operations Manager to review assistants and vessel names in a presentation-ready layout.</span>
        </div>
        <footer className="chart-footer">
          <span>{data.footerText}</span>
          <span>{data.organizationName || 'Crew Operations Organization Chart'}</span>
        </footer>
      </div>
    )
  }

  if (!operationsManagers.length) {
    return (
      <div className="chart-view chart-view--compact-top operations-allocation-view">
        <ChartHeader
          title="Operations & Vessel Allocation"
          subtitle={`Crew Director: ${director?.person.name || 'Not selected'}`}
        />
        <div className="leadership-stack operations-focus-stack">
          {director ? <PersonCard person={director.person} level="head" /> : null}
        </div>
        <div className="chart-empty-state">
          <strong>No Crew Operations Managers found under this Crew Director.</strong>
          <span>Select another Crew Director or add a Crew Operations Manager to continue.</span>
        </div>
        <footer className="chart-footer">
          <span>{data.footerText}</span>
          <span>{director?.person.name || 'Crew Director'}</span>
        </footer>
      </div>
    )
  }

  if (!operationsManager) {
    return (
      <div className="chart-view chart-view--compact-top operations-allocation-view">
        <ChartHeader
          title="Operations & Vessel Allocation"
          subtitle={`Crew Director: ${director?.person.name || 'Not selected'}`}
        />
        <div className="leadership-stack operations-focus-stack">
          {director ? <PersonCard person={director.person} level="head" /> : null}
        </div>
        <div className="chart-empty-state">
          <strong>No matching team found for the selected filters.</strong>
          <span>Choose another Crew Operations Manager or reset the filters.</span>
        </div>
        <footer className="chart-footer">
          <span>{data.footerText}</span>
          <span>{operationsManagers.length} Crew Operations Managers</span>
        </footer>
      </div>
    )
  }

  return (
    <div className="chart-view chart-view--compact-top operations-allocation-view">
      <ChartHeader
        title="Operations & Vessel Allocation"
        subtitle={crewManagerId
          ? `Focused allocation for ${visibleCrewManagers[0]?.person.name || 'selected Crew Manager'}`
          : 'Filtered team structure with vessel names for management presentation'}
      />

      <div className="leadership-stack operations-focus-stack">
        {director ? <PersonCard person={director.person} level="head" /> : null}
        <div className="connector leadership-connector" />
        <PersonCard person={operationsManager.person} level="operations" />
        <div className={`hierarchy-beam beam-count-${Math.min(Math.max(visibleCrewManagers.length, 1), 4)}`}>
          <span className="hierarchy-beam__vertical" />
          {visibleCrewManagers.length > 1 ? <span className="hierarchy-beam__horizontal" /> : null}
        </div>
      </div>

      <div className="operations-focus-summary">
        <span><strong>Crew Director</strong>{director?.person.name || 'Not selected'}</span>
        <span><strong>Crew Operations Manager</strong>{operationsManager.person.name}</span>
        <span><strong>Crew Managers</strong>{visibleCrewManagers.length} · {visibleVesselCount} vessels</span>
      </div>

      <div className="chart-guidance">Use zoom or scroll to review larger teams. Layout adapts automatically to keep every card visible.</div>

      <div className={`team-grid operations-focus-grid layout-${layoutMode} manager-count-${Math.min(Math.max(visibleCrewManagers.length, 1), 4)}`}>
        {visibleCrewManagers.length ? visibleCrewManagers.map((team) => (
          <TeamCard
            key={team.id}
            team={team}
            vessels={data.vessels.filter((item) => item.crewManagerId === team.id || item.crewManagerId === team.person.id)}
            vesselNamesOnly
          />
        )) : (
          <div className="chart-empty-state">
            <strong>No Crew Managers found under this Crew Operations Manager.</strong>
            <span>This Operations Manager is visible, but no Crew Manager team cards have been added yet.</span>
          </div>
        )}
      </div>

      <footer className="chart-footer">
        <span>{data.footerText}</span>
        <span>{visibleVesselCount} vessel names shown</span>
      </footer>
    </div>
  )
}
