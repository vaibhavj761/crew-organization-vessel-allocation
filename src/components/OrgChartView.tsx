import { useChart } from '../state/ChartContext'
import { getCrewManagerLayoutMode } from '../utils/chartLayout'
import { ChartHeader } from './ChartHeader'
import { PersonCard } from './PersonCard'
import { TeamCard } from './TeamCard'

export function OrgChartView({ selectedDirectorId = '' }: { selectedDirectorId?: string }) {
  const { data } = useChart()
  const visibleDirectors = selectedDirectorId ? data.crewDirectors.filter((director) => director.id === selectedDirectorId) : data.crewDirectors

  return (
    <div className="chart-view chart-view--compact-top org-chart">
      <ChartHeader title="Organization Chart" subtitle="Executive crew reporting structure for management review" />
      <div className="chart-guidance">Use zoom or scroll to review larger leadership teams. Cards wrap automatically to avoid cropping.</div>

      {visibleDirectors.length ? (
        <div className="org-director-grid">
          {visibleDirectors.map((director) => {
            const directorOps = data.operationsManagers.filter((op) => op.crewDirectorId === director.id)

            return (
              <section className="org-director-section" key={director.id}>
                <div className="director-row">
                  <PersonCard person={director.person} level="head" compact />
                </div>

                {directorOps.length ? (
                  <div className="org-operations-grid">
                    {directorOps.map((op) => {
                      const layoutMode = getCrewManagerLayoutMode(op.crewManagers.length)

                      return (
                        <section className="org-operations-section" key={op.id}>
                          <div className="operations-heading">
                            <div>
                              <strong>{op.person.name}</strong>
                              <span>{op.person.designation}</span>
                            </div>
                            <b>{op.crewManagers.length} teams</b>
                          </div>

                          <div className={`org-crew-manager-grid layout-${layoutMode}`}>
                            {op.crewManagers.length ? op.crewManagers.map((cm) => (
                              <TeamCard
                                key={cm.id}
                                team={cm}
                                vessels={data.vessels.filter((v) => v.crewManagerId === cm.id || v.crewManagerId === cm.person.id)}
                                compact
                                vesselNamesOnly
                              />
                            )) : (
                              <div className="chart-empty-state">
                                <strong>No Crew Managers assigned yet</strong>
                                <span>Add a Crew Manager to build this Operations Manager team.</span>
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
        <span>{visibleDirectors.length} crew directors · {data.operationsManagers.length} crew operations managers · {data.vessels.length} vessels</span>
      </footer>
    </div>
  )
}
