import { useMemo } from 'react'
import { useChart } from '../state/ChartContext'
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
    () => operationsManagers.find((item) => item.id === operationsManagerId) || operationsManagers[0],
    [operationsManagerId, operationsManagers],
  )

  const visibleCrewManagers = useMemo(
    () => getCrewManagersForOperationsManager(operationsManager, crewManagerId),
    [crewManagerId, operationsManager],
  )

  if (!crewDirectorId) {
    return (
      <div className="chart-view operations-allocation-view">
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
      <div className="chart-view operations-allocation-view">
        <ChartHeader
          title="Operations & Vessel Allocation"
          subtitle={`Crew Director: ${director?.person.name || 'Not selected'}`}
        />
        <div className="leadership-stack operations-focus-stack">
          {director ? <PersonCard person={director.person} level="head" /> : null}
        </div>
        <div className="chart-empty-state">
          <strong>No Crew Operations Managers assigned yet.</strong>
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
      <div className="chart-view operations-allocation-view">
        <ChartHeader
          title="Operations & Vessel Allocation"
          subtitle={`Crew Director: ${director?.person.name || 'Not selected'}`}
        />
        <div className="leadership-stack operations-focus-stack">
          {director ? <PersonCard person={director.person} level="head" /> : null}
        </div>
        <div className="chart-empty-state">
          <strong>Select a Crew Operations Manager.</strong>
          <span>Choose a Crew Operations Manager from the filter to review the team structure and vessel allocation.</span>
        </div>
        <footer className="chart-footer">
          <span>{data.footerText}</span>
          <span>{operationsManagers.length} Crew Operations Managers</span>
        </footer>
      </div>
    )
  }

  return (
    <div className="chart-view operations-allocation-view">
      <ChartHeader
        title="Operations & Vessel Allocation"
        subtitle={crewManagerId
          ? `Focused allocation for ${visibleCrewManagers[0]?.person.name || 'selected Crew Manager'}`
          : 'Filtered team structure with vessel names for management presentation'}
      />

      <div className="leadership-stack operations-focus-stack">
        {director ? <PersonCard person={director.person} level="head" /> : null}
        <div className="connector" />
        <PersonCard person={operationsManager.person} level="operations" />
        <div className="connector branch" />
      </div>

      <div className="operations-focus-summary">
        <span><strong>Crew Director</strong>{director?.person.name || 'Not selected'}</span>
        <span><strong>Crew Operations Manager</strong>{operationsManager.person.name}</span>
        <span><strong>Crew Managers</strong>{visibleCrewManagers.length}</span>
      </div>

      <div className="team-grid operations-focus-grid">
        {visibleCrewManagers.length ? visibleCrewManagers.map((team) => (
          <TeamCard
            key={team.id}
            team={team}
            vessels={data.vessels.filter((item) => item.crewManagerId === team.id || item.crewManagerId === team.person.id)}
            vesselNamesOnly
          />
        )) : (
          <div className="chart-empty-state">
            <strong>No Crew Managers available for this selection.</strong>
            <span>Choose “All Crew Managers” or select another Crew Operations Manager.</span>
          </div>
        )}
      </div>

      <footer className="chart-footer">
        <span>{data.footerText}</span>
        <span>{visibleCrewManagers.reduce((total, team) => total + data.vessels.filter((item) => item.crewManagerId === team.id || item.crewManagerId === team.person.id).length, 0)} vessel names shown</span>
      </footer>
    </div>
  )
}
