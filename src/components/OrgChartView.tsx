import { useChart } from '../state/ChartContext'
import { ChartHeader } from './ChartHeader'
import { PersonCard } from './PersonCard'
import { TeamCard } from './TeamCard'

export function OrgChartView() {
  const { data } = useChart()
  return <div className="chart-view org-chart"><ChartHeader/>{data.crewDirectors.length ? <div className="operations-overview">{data.crewDirectors.map(director => { const directorOps = data.operationsManagers.filter(op => op.crewDirectorId === director.id); return <section className="operations-group" key={director.id}><div className="director-row"><PersonCard person={director.person} eyebrow="Crew Director" level="head" compact/></div><div className="overview-team-grid">{directorOps.map(op=><section className="operations-group" key={op.id}><div className="operations-heading"><div><strong>{op.person.name}</strong><span>{op.person.designation}</span></div><b>{op.crewManagers.length} teams</b></div><div className="overview-team-grid">{op.crewManagers.map(cm=><TeamCard key={cm.id} team={cm} vessels={data.vessels.filter(v=>v.crewManagerId===cm.id)} compact/>)}</div></section>)}</div></section>})}</div> : <div className="chart-empty-state"><strong>No Crew Directors added yet</strong><span>Add a Crew Director to begin building the organization chart.</span></div>}<footer className="chart-footer"><span>{data.footerText}</span><span>{data.crewDirectors.length} crew directors · {data.operationsManagers.length} operations managers · {data.vessels.length} vessels</span></footer></div>
}
