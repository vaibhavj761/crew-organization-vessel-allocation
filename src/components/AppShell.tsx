import { Check, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useChart } from '../state/ChartContext'
import type { SafeUser, ViewMode } from '../types'
import { AccessDeniedPage } from './AccessDeniedPage'
import { AdminAccessRequests } from './AdminAccessRequests'
import { AuthShell } from './AuthShell'
import { DashboardPage } from './DashboardPage'
import { EditorPanel } from './EditorPanel'
import { ExportToolbar } from './ExportToolbar'
import { OrgChartView } from './OrgChartView'
import { OperationsDetailView } from './OperationsDetailView'
import { VesselAllocationView } from './VesselAllocationView'
import { VesselMasterTable } from './VesselMasterTable'

export function AppShell({
  viewMode,
  onViewModeChange,
  user,
  canEdit,
  canAdmin,
  onRefresh,
  onLogout,
}: {
  viewMode: ViewMode
  onViewModeChange: (m: ViewMode) => void
  user: SafeUser
  canEdit: boolean
  canAdmin: boolean
  onRefresh: () => void
  onLogout: () => void | Promise<void>
}) {
  const { data, saveState, hasUnsavedChanges, errorMessage, syncNotice, saveChanges, loadState, reloadFromServer } = useChart()
  const [editorOpen, setEditorOpen] = useState(true)
  const [selectedOps, setSelectedOps] = useState(data.operationsManagers[0]?.id || '')
  const [selectedDirector, setSelectedDirector] = useState(data.crewDirectors[0]?.id || '')
  const refreshedViewRef = useRef<ViewMode | ''>('')

  useEffect(() => {
    if (!data.operationsManagers.some((op) => op.id === selectedOps)) {
      setSelectedOps(data.operationsManagers[0]?.id || '')
    }
  }, [data.operationsManagers, selectedOps])
  useEffect(() => {
    if (!data.crewDirectors.some((director) => director.id === selectedDirector)) {
      setSelectedDirector(data.crewDirectors[0]?.id || '')
    }
  }, [data.crewDirectors, selectedDirector])

  useEffect(() => {
    refreshedViewRef.current = ''
  }, [hasUnsavedChanges])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [hasUnsavedChanges])

  useEffect(() => {
    if (viewMode === 'access') return
    if (loadState !== 'ready' || hasUnsavedChanges) return
    if (refreshedViewRef.current === viewMode) return
    refreshedViewRef.current = viewMode
    void reloadFromServer(true)
  }, [viewMode, loadState, hasUnsavedChanges, reloadFromServer])

  const modes: [ViewMode, string][] = [
    ['dashboard', 'Dashboard'],
    ['overview', 'Organization'],
    ['detail', 'Operations detail'],
    ['allocation', 'Vessel allocation'],
    ['vessels', 'Vessel master'],
  ]
  if (canAdmin) modes.push(['access', 'Access management'])

  return (
    <div className={`app-shell ${editorOpen ? '' : 'editor-collapsed'} ${canEdit ? '' : 'read-only'}`}>
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">CP</span>
          <span>
            <strong>Crew Planner</strong>
            <small>Organization & allocation</small>
          </span>
        </div>
        <div className="view-switcher">
          {modes.map(([m, l]) => (
            <button key={m} className={viewMode === m ? 'active' : ''} onClick={() => onViewModeChange(m)}>
              {l}
            </button>
          ))}
        </div>
        <div className="header-actions">
          <AuthShell user={user} onLogout={onLogout} onRefresh={onRefresh} />
          {canEdit && viewMode !== 'access' && <button className="button" onClick={() => void saveChanges()} disabled={loadState !== 'ready' || saveState === 'saving' || !hasUnsavedChanges}>{saveState === 'saving' ? 'Saving…' : hasUnsavedChanges ? 'Save changes' : 'Saved'}</button>}
          <span className={`save-state ${saveState === 'error' ? 'save-error' : ''}`} title={errorMessage || undefined}>
            <Check size={14} />
            {saveState === 'saved' ? (hasUnsavedChanges ? 'Unsaved changes' : 'Saved to database') : saveState === 'saving' ? 'Saving…' : errorMessage || 'Could not sync'}
          </span>
          {(viewMode === 'overview' || viewMode === 'detail' || viewMode === 'allocation') && <ExportToolbar viewMode={viewMode} selectedOperationsManagerId={selectedOps} selectedCrewDirectorId={selectedDirector} />}
        </div>
      </header>
      <main className="workspace">
        {canEdit && editorOpen && viewMode !== 'access' && <EditorPanel />}
        <section className="canvas-workspace">
          {loadState === 'loading' && <div className="page-loading-banner">Loading latest database data…</div>}
          {syncNotice && <div className="page-loading-banner notice">{syncNotice}</div>}
          <div className="canvas-toolbar">
            {canEdit && viewMode !== 'access' && (
              <button className="icon-button" onClick={() => setEditorOpen((v) => !v)} disabled={loadState !== 'ready'}>
                {editorOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
              </button>
            )}
            {(viewMode === 'detail' || viewMode === 'allocation') && (
              <label className="inline-select">
                Select Operations Manager
                <select value={selectedOps} onChange={(e) => setSelectedOps(e.target.value)}>
                  <option value="">All operations managers</option>
                  {data.operationsManagers.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.person.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {viewMode === 'overview' && !!data.crewDirectors.length && (
              <label className="inline-select">
                Select Crew Director
                <select value={selectedDirector} onChange={(e) => setSelectedDirector(e.target.value)}>
                  {data.crewDirectors.map((director) => (
                    <option key={director.id} value={director.id}>
                      {director.person.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!canEdit && <span className="read-only-pill">Read-only access</span>}
            <span className="zoom-label">{viewMode === 'dashboard' ? 'Connected workspace' : viewMode === 'access' ? 'Administrator workspace' : '16:9 presentation preview'}</span>
          </div>
          {viewMode === 'dashboard' ? (
            <DashboardPage />
          ) : viewMode === 'access' ? (
            canAdmin ? <AdminAccessRequests /> : <AccessDeniedPage />
          ) : viewMode === 'vessels' ? (
            <VesselMasterTable canEdit={canEdit} />
          ) : (
            <div className="canvas-stage">
              <div className="presentation-frame">
                {viewMode === 'overview' ? (
                  <OrgChartView />
                ) : viewMode === 'detail' ? (
                  <OperationsDetailView operationsManagerId={selectedOps} />
                ) : (
                  <VesselAllocationView operationsManagerId={selectedOps} />
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
