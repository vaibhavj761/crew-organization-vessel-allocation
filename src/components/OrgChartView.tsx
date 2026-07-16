import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { useChart, type HierarchyPersonTarget } from '../state/ChartContext'
import type { Person } from '../types'
import { ChartHeader } from './ChartHeader'
import { PersonCard } from './PersonCard'
import { TeamCard } from './TeamCard'
import { InlinePersonEditor } from './InlinePersonEditor'

export function OrgChartView({ selectedDirectorId = '', canEdit = false }: { selectedDirectorId?: string; canEdit?: boolean }) {
  const { data, saveHierarchyPerson } = useChart()
  const [editing, setEditing] = useState<{ target: HierarchyPersonTarget; person: Person; levelLabel: string } | null>(null)
  const visibleDirectors = selectedDirectorId ? data.crewDirectors.filter((director) => director.id === selectedDirectorId) : data.crewDirectors

  return (
    <div className="chart-view chart-view--compact-top org-chart">
      <ChartHeader title="Organization Chart" subtitle="Reporting structure only: Crew Director, Operations Manager, Deputy Manager and Crew Manager" />
      <div className="chart-guidance">This view shows reporting hierarchy only. Vessel names are shown in Operations & Vessel Allocation.</div>

      {visibleDirectors.length ? (
        <div className="org-director-grid">
          {visibleDirectors.map((director) => {
            const directorOps = data.operationsManagers.filter((op) => op.crewDirectorId === director.id)

            return (
              <section className="org-director-section" key={director.id}>
                <div className="director-row">
                  <PersonCard person={director.person} level="head" compact onEdit={canEdit ? () => setEditing({ target: { kind: 'crewDirector', id: director.id }, person: director.person, levelLabel: 'Crew Director' }) : undefined} />
                </div>

                {directorOps.length ? (
                  <div className="org-operations-grid">
                    {directorOps.map((op) => (
                      <section className="org-operations-section" key={op.id}>
                        <div className="operations-heading">
                          <div>
                            <strong>{op.person.name}</strong>
                            <span>{op.person.designation}</span>
                          </div>
                          <b>{op.person.notes || `${op.deputyManagers.length} deputies`}</b>
                          {canEdit ? <button type="button" className="chart-inline-edit" onClick={() => setEditing({ target: { kind: 'operationsManager', id: op.id }, person: op.person, levelLabel: 'Crew Operations Manager' })} aria-label={`Edit ${op.person.name}`}><Pencil size={12} /></button> : null}
                        </div>

                        <div className="org-deputy-grid">
                          {op.deputyManagers.length ? op.deputyManagers.map((deputy) => (
                            <section className="org-deputy-section" key={deputy.id}>
                              <div className="deputy-heading">
                                <strong>{deputy.person.name}</strong>
                                <span>{deputy.person.designation || 'Deputy Crew Manager'}</span>
                                <b>{deputy.person.notes || `${deputy.crewManagers.length} crew managers`}</b>
                                {canEdit ? <button type="button" className="chart-inline-edit" onClick={() => setEditing({ target: { kind: 'deputyManager', id: deputy.id, operationsManagerId: op.id }, person: deputy.person, levelLabel: 'Deputy Manager' })} aria-label={`Edit ${deputy.person.name}`}><Pencil size={12} /></button> : null}
                              </div>
                              <div className="org-crew-manager-grid layout-many">
                                {deputy.crewManagers.length ? deputy.crewManagers.map((cm) => (
                                  <TeamCard
                                    key={cm.id}
                                    team={cm}
                                    vessels={data.vessels.filter((v) => v.crewManagerId === cm.id || v.crewManagerId === cm.person.id)}
                                    compact
                                    showVessels={false}
                                    onEdit={canEdit ? () => setEditing({ target: { kind: 'crewManager', id: cm.id, deputyManagerId: deputy.id }, person: cm.person, levelLabel: 'Crew Manager' }) : undefined}
                                  />
                                )) : (
                                  <div className="chart-empty-state">
                                    <strong>No Crew Managers assigned yet</strong>
                                    <span>Add a Crew Manager below this Deputy Manager.</span>
                                  </div>
                                )}
                              </div>
                            </section>
                          )) : (
                            <div className="chart-empty-state">
                              <strong>No Deputy Managers assigned yet</strong>
                              <span>Add a Deputy Manager before adding Crew Managers.</span>
                            </div>
                          )}
                        </div>
                      </section>
                    ))}
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
    </div>
  )
}
