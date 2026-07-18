import { useMemo, useState } from 'react'
import type { CrewManagerNode, Vessel } from '../types'
import { useChart } from '../state/ChartContext'
import { getCrewManagerLayoutMode } from '../utils/chartLayout'
import { getDeputyManagersForOperationsManager } from '../utils/operationsAllocation'
import { ChartHeader } from './ChartHeader'
import { PersonCard } from './PersonCard'
import { TeamCard } from './TeamCard'
import { VesselAllocationDialog } from './VesselAllocationDialog'

export function OperationsAllocationView({
  crewDirectorId,
  operationsManagerId,
  deputyManagerId,
  crewManagerId,
  canEdit = false,
}: {
  crewDirectorId: string
  operationsManagerId: string
  deputyManagerId: string
  crewManagerId: string
  canEdit?: boolean
}) {
  const { data, assignVesselFromChart, unassignVesselFromChart, saveVesselFromChart } = useChart()
  const [dialog, setDialog] = useState<{ mode: 'assign' | 'edit' | 'unassign'; team: CrewManagerNode; vessel?: Vessel } | null>(null)

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

  const visibleDeputies = useMemo(
    () => getDeputyManagersForOperationsManager(operationsManager, deputyManagerId)
      .map((deputy) => ({
        ...deputy,
        crewManagers: crewManagerId ? deputy.crewManagers.filter((team) => team.id === crewManagerId) : deputy.crewManagers,
      }))
      .filter((deputy) => deputy.crewManagers.length || !crewManagerId),
    [crewManagerId, deputyManagerId, operationsManager],
  )
  const visibleCrewManagers = visibleDeputies.flatMap((deputy) => deputy.crewManagers)
  const visibleVesselCount = visibleCrewManagers.reduce((total, team) => total + data.vessels.filter((item) => item.crewManagerId === team.id || item.crewManagerId === team.person.id).length, 0)

  if (!crewDirectorId) {
    return (
      <div className="chart-view chart-view--compact-top operations-allocation-view">
        <ChartHeader title="Operations & Vessel Allocation" subtitle="Select a Crew Director to view allocation." />
        <div className="chart-empty-state">
          <strong>Select a Crew Director to view vessel allocation.</strong>
          <span>Then filter by Operations Manager, Deputy Manager, and Crew Manager.</span>
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
        <ChartHeader title="Operations & Vessel Allocation" subtitle={`Crew Director: ${director?.person.name || 'Not selected'}`} />
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
        <ChartHeader title="Operations & Vessel Allocation" subtitle={`Crew Director: ${director?.person.name || 'Not selected'}`} />
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
          : 'Filtered allocation by Deputy Manager and Crew Manager'}
      />

      <div className="leadership-stack operations-focus-stack">
        {director ? <PersonCard person={director.person} level="head" /> : null}
        <div className="connector leadership-connector" />
        <PersonCard person={operationsManager.person} level="operations" />
      </div>

      <div className="operations-focus-summary">
        <span><strong>Crew Director</strong>{director?.person.name || 'Not selected'}</span>
        <span><strong>Crew Operations Manager</strong>{operationsManager.person.name}</span>
        <span><strong>Allocation</strong>{visibleDeputies.length} deputies · {visibleCrewManagers.length} crew managers · {visibleVesselCount} vessels</span>
      </div>

      <div className="deputy-allocation-grid">
        {visibleDeputies.length ? visibleDeputies.map((deputy) => {
          const layoutMode = getCrewManagerLayoutMode(deputy.crewManagers.length)
          return (
            <section className="deputy-allocation-section" key={deputy.id}>
              <div className="deputy-heading">
                <strong>{deputy.person.name}</strong>
                <span>{deputy.person.designation || 'Deputy Crew Manager'}</span>
                <b>{deputy.crewManagers.length} crew managers</b>
              </div>
              <div className={`team-grid operations-focus-grid layout-${layoutMode} manager-count-${Math.min(Math.max(deputy.crewManagers.length, 1), 4)}`}>
                {deputy.crewManagers.length ? deputy.crewManagers.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    vessels={data.vessels.filter((item) => item.crewManagerId === team.id || item.crewManagerId === team.person.id)}
                    vesselNamesOnly
                    onAssignVessel={canEdit ? () => setDialog({ mode: 'assign', team }) : undefined}
                    onEditVessel={canEdit ? (vessel) => setDialog({ mode: 'edit', team, vessel }) : undefined}
                    onUnassignVessel={canEdit ? (vessel) => setDialog({ mode: 'unassign', team, vessel }) : undefined}
                  />
                )) : (
                  <div className="chart-empty-state">
                    <strong>No Crew Managers found under this Deputy Manager.</strong>
                    <span>Add Crew Managers or select another Deputy Manager.</span>
                  </div>
                )}
              </div>
            </section>
          )
        }) : (
          <div className="chart-empty-state">
            <strong>No Deputy Managers found under this Crew Operations Manager.</strong>
            <span>Add Deputy Managers before assigning Crew Managers and vessels.</span>
          </div>
        )}
      </div>

      <footer className="chart-footer">
        <span>{data.footerText}</span>
        <span>{visibleVesselCount} vessel names shown</span>
      </footer>
      {dialog ? <VesselAllocationDialog
        mode={dialog.mode}
        team={dialog.team}
        vessel={dialog.vessel}
        vessels={data.vessels}
        onClose={() => setDialog(null)}
        onAssign={(vesselId) => assignVesselFromChart(vesselId, dialog.team.id)}
        onSave={saveVesselFromChart}
        onUnassign={unassignVesselFromChart}
      /> : null}
    </div>
  )
}
