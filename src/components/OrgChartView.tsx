import { useChart } from '../state/ChartContext'
import { getCrewManagerLayoutMode } from '../utils/chartLayout'
import { ChartHeader } from './ChartHeader'
import { PersonCard } from './PersonCard'
import { TeamCard } from './TeamCard'

export function OrgChartView({ selectedDirectorId = '' }: { selectedDirectorId?: string }) {
  const { data } = useChart()
  const visibleDirectors = selectedDirectorId ? data.crewDirectors.filter((director) => director.id === selectedDirectorId) : data.crewDirectors
  return <div className="chart-view org-chart"><ChartHeader title="Organization Chart" subtitle="Executive crew reporting structure for management review" /><div className="chart-guidance">Use zoom or scroll to review larger leadership teams. Cards wrap automatically to avoid cropping.</div>{visibleDirectors.length ? <div className="operations-overview">{visibleDirectors.map(director => { const directorOps = data.operationsManagers.filter(op => op.crewDirectorId === director.id); return <section className="operations-group" key={director.id}><div className="director-row"><PersonCard person={director.person} level="head" compact/></div><div className="overview-team-grid">{directorOps.map(op=><section className="operations-group" key={op.id}><div className="operations-heading"><div><strong>{op.person.name}</strong><span>{op.person.designation}</span></div><b>{op.crewManagers.length} teams</b></div><div className={`overview-team-grid layout-${getCrewManagerLayoutMode(op.crewManagers.length)}`}>{op.crewManagers.map(cm=><TeamCard key={cm.id} team={cm} vessels={data.vessels.filter(v=>v.crewManagerId===cm.id||v.crewManagerId===cm.person.id)} compact vesselNamesOnly />)}</div></section>)}</div></section>})}</div> : <div className="chart-empty-state"><strong>No Crew Directors added yet</strong><span>Add a Crew Director to begin building the organization chart.</span></div>}<footer className="chart-footer"><span>{data.footerText}</span><span>{visibleDirectors.length} crew directors · {data.operationsManagers.length} crew operations managers · {data.vessels.length} vessels</span></footer></div>
}
