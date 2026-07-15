import { Building2, Database, UsersRound } from 'lucide-react'
import { useChart } from '../state/ChartContext'
import { HeaderEditor } from './HeaderEditor'
import { ImportExportPanel } from './ImportExportPanel'
import { HierarchyEditor } from './HierarchyEditor'

function Section({
  icon,
  title,
  children,
  open = false,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  open?: boolean
}) {
  return (
    <details className="editor-section" open={open}>
      <summary>{icon}<span>{title}</span></summary>
      <div className="editor-section-content">{children}</div>
    </details>
  )
}

export function EditorPanel({
  selectedDirectorId,
  selectedOperationsManagerId,
  selectedCrewManagerId,
}: {
  selectedDirectorId?: string
  selectedOperationsManagerId?: string
  selectedCrewManagerId?: string
}) {
  const { data, hasUnsavedChanges } = useChart()
  const director = data.crewDirectors.find((item) => item.id === selectedDirectorId)
  const operationsManager = data.operationsManagers.find((item) => item.id === selectedOperationsManagerId)
  const crewManager = data.operationsManagers.flatMap((item) => item.deputyManagers.flatMap((deputy) => deputy.crewManagers)).find((item) => item.id === selectedCrewManagerId)

  return (
    <aside className="editor-panel">
      <div className="editor-title">
        <span>Chart editor</span>
        <small>{hasUnsavedChanges ? 'Unsaved changes pending' : 'Connected to database'}</small>
      </div>

      <div className="editor-scroll">
        <div className="editor-context-panel">
          <strong>Current selection</strong>
          <div className="editor-context-grid">
            <span><b>Crew Director</b>{director?.person.name || 'None selected'}</span>
            <span><b>Crew Operations Manager</b>{operationsManager?.person.name || 'None selected'}</span>
            <span><b>Crew Manager</b>{crewManager?.person.name || 'All Crew Managers'}</span>
          </div>
          <p className="helper-copy">Use the top filters to focus a leadership team before exporting a presentation-ready chart.</p>
        </div>

        <Section icon={<Building2 size={16} />} title="Chart settings" open>
          <HeaderEditor />
        </Section>

        <Section icon={<UsersRound size={16} />} title={`Crew hierarchy (${data.crewDirectors.length} directors)`} open>
          <HierarchyEditor />
        </Section>

        <Section icon={<Database size={16} />} title="Backup, import & export">
          <p className="helper-copy">Use JSON backup for data safety. Use the page export controls for presentation images.</p>
          <ImportExportPanel />
        </Section>
      </div>
    </aside>
  )
}
