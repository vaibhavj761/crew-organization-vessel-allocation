import { Bot, Check, PanelLeftClose, PanelLeftOpen, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { APP_NAME, APP_SHORT_NAME, getPageTitle } from '../constants/app'
import { useChart } from '../state/ChartContext'
import type { SafeUser, ViewMode } from '../types'
import { canExport, isReadOnly } from '../utils/permissions'
import { AccessDeniedPage } from './AccessDeniedPage'
import { AdminAccessRequests } from './AdminAccessRequests'
import { AiAssistantPage } from './AiAssistantPage'
import { AuthShell } from './AuthShell'
import { ChartErrorBoundary } from './ChartErrorBoundary'
import { DashboardPage } from './DashboardPage'
import { EditorPanel } from './EditorPanel'
import { ExportToolbar } from './ExportToolbar'
import { OperationsAllocationView } from './OperationsAllocationView'
import { OrgChartView } from './OrgChartView'
import { VesselMasterTable } from './VesselMasterTable'
import type { AiScope } from '../types'

export function AppShell({
  viewMode,
  onViewModeChange,
  user,
  canEdit,
  canAdmin,
  onRefresh,
  onLogout,
  onUnsavedChangesChange,
}: {
  viewMode: ViewMode
  onViewModeChange: (m: ViewMode) => void
  user: SafeUser
  canEdit: boolean
  canAdmin: boolean
  onRefresh: () => void
  onLogout: () => void | Promise<void>
  onUnsavedChangesChange?: (value: boolean) => void
}) {
  const { data, saveState, hasUnsavedChanges, errorMessage, syncNotice, saveChanges, loadState, refreshWorkspaceData } = useChart()
  const [editorOpen, setEditorOpen] = useState(true)
  const [selectedOps, setSelectedOps] = useState('')
  const [selectedDirector, setSelectedDirector] = useState('')
  const [selectedCrewManager, setSelectedCrewManager] = useState('')
  const [chartZoom, setChartZoom] = useState(1)
  const [aiInitialScope, setAiInitialScope] = useState<AiScope>('auto')
  const showEditorSidebar = canEdit && editorOpen && viewMode !== 'access' && viewMode !== 'ai'
  const readOnly = isReadOnly(user)
  const allowExport = canExport(user)

  const operationsManagersForDirector = useMemo(
    () => (selectedDirector
      ? data.operationsManagers.filter((op) => op.crewDirectorId === selectedDirector)
      : []),
    [data.operationsManagers, selectedDirector],
  )
  const selectedOperationsManager = useMemo(
    () => operationsManagersForDirector.find((op) => op.id === selectedOps) || operationsManagersForDirector[0],
    [operationsManagersForDirector, selectedOps],
  )
  const selectedCrewManagers = useMemo(
    () => selectedOperationsManager?.crewManagers || [],
    [selectedOperationsManager],
  )

  useEffect(() => {
    if (viewMode !== 'operations') return
    if (!selectedDirector && data.crewDirectors.length === 1) {
      setSelectedDirector(data.crewDirectors[0].id)
    }
  }, [data.crewDirectors, selectedDirector, viewMode])

  useEffect(() => {
    if (!selectedDirector) {
      if (selectedOps) setSelectedOps('')
      if (selectedCrewManager) setSelectedCrewManager('')
      return
    }

    if (!operationsManagersForDirector.some((op) => op.id === selectedOps)) {
      setSelectedOps(operationsManagersForDirector[0]?.id || '')
      setSelectedCrewManager('')
    }
  }, [operationsManagersForDirector, selectedDirector, selectedOps, selectedCrewManager])

  useEffect(() => {
    if (selectedCrewManager && !selectedCrewManagers.some((manager) => manager.id === selectedCrewManager)) {
      setSelectedCrewManager('')
    }
  }, [selectedCrewManager, selectedCrewManagers])

  useEffect(() => {
    onUnsavedChangesChange?.(hasUnsavedChanges)
  }, [hasUnsavedChanges, onUnsavedChangesChange])

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
    document.title = getPageTitle(viewMode)
  }, [viewMode])

  useEffect(() => {
    setChartZoom(1)
  }, [viewMode, selectedDirector, selectedOps, selectedCrewManager])

  const confirmDiscardChanges = () => {
    if (!hasUnsavedChanges) return true
    return window.confirm('You have unsaved changes. Refreshing or leaving this page will discard them. Continue?')
  }

  const refreshPageData = async () => {
    if (loadState !== 'ready') return
    if (!confirmDiscardChanges()) return
    await refreshWorkspaceData('manual-refresh')
  }

  const handleViewModeChange = (nextView: ViewMode) => {
    if (nextView === viewMode) return
    if (!confirmDiscardChanges()) return
    onViewModeChange(nextView)
    if (loadState === 'ready') {
      const refreshReasonByView: Partial<Record<ViewMode, Parameters<typeof refreshWorkspaceData>[0]>> = {
        dashboard: 'nav-click-dashboard',
        overview: 'nav-click-organization',
        operations: 'nav-click-operations',
        vessels: 'nav-click-vessel-master',
      }
      const reason = refreshReasonByView[nextView]
      if (reason) {
        void refreshWorkspaceData(reason)
      }
    }
  }

  const modes: [ViewMode, string][] = [
    ['dashboard', 'Dashboard'],
    ['overview', 'Organization Chart'],
    ['operations', 'Operations & Vessel Allocation'],
    ['vessels', 'Vessel Master'],
  ]
  if (canEdit) modes.push(['ai', 'AI Assistant'])
  if (canAdmin) modes.push(['access', 'Access management'])

  const openAiAssistant = (scope: AiScope) => {
    setAiInitialScope(scope)
    handleViewModeChange('ai')
  }

  return (
    <div className={`app-shell ${showEditorSidebar ? '' : 'editor-collapsed workspace-full'} ${canEdit ? '' : 'read-only'}`}>
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">CO</span>
          <span>
            <strong>{APP_SHORT_NAME}</strong>
            <small>{APP_NAME}</small>
          </span>
        </div>
        <div className="view-switcher">
          {modes.map(([m, l]) => (
            <button key={m} className={viewMode === m ? 'active' : ''} onClick={() => handleViewModeChange(m)}>
              {l}
            </button>
          ))}
        </div>
        <div className="header-actions">
          <AuthShell user={user} onLogout={onLogout} onRefresh={onRefresh} />
          {viewMode !== 'access' && viewMode !== 'ai' && (
            <button className="button secondary" onClick={() => void refreshPageData()} disabled={loadState !== 'ready' || saveState === 'saving'}>
              <RefreshCw size={14} />
              Refresh
            </button>
          )}
          {canEdit && viewMode !== 'access' && viewMode !== 'ai' && <button className="button" onClick={() => void saveChanges()} disabled={loadState !== 'ready' || saveState === 'saving' || !hasUnsavedChanges}>{saveState === 'saving' ? 'Saving…' : hasUnsavedChanges ? 'Save changes' : 'Saved'}</button>}
          {canEdit ? (
            <span className={`save-state ${saveState === 'error' ? 'save-error' : ''}`} title={errorMessage || undefined}>
              <Check size={14} />
              {saveState === 'saved' ? (hasUnsavedChanges ? 'Unsaved changes' : 'Saved to database') : saveState === 'saving' ? 'Saving…' : errorMessage || 'Could not sync'}
            </span>
          ) : (
            <span className="save-state read-only-state">
              <Check size={14} />
              {syncNotice || 'Read-only view'}
            </span>
          )}
          {allowExport && (viewMode === 'overview' || viewMode === 'operations') && <ExportToolbar viewMode={viewMode} selectedOperationsManagerId={selectedOps} selectedCrewDirectorId={selectedDirector} selectedCrewManagerId={selectedCrewManager} />}
        </div>
      </header>
      <main className="workspace">
        {showEditorSidebar && <EditorPanel selectedDirectorId={selectedDirector} selectedOperationsManagerId={selectedOps} selectedCrewManagerId={selectedCrewManager} />}
        <section className={`canvas-workspace view-${viewMode} ${showEditorSidebar ? 'with-editor' : 'full-width'}`}>
          {loadState === 'loading' && <div className="page-loading-banner">Loading latest database data…</div>}
          {syncNotice && <div className="page-loading-banner notice">{syncNotice}</div>}
          <div className="canvas-toolbar">
            {canEdit && viewMode !== 'access' && (
              <button className="icon-button" onClick={() => setEditorOpen((v) => !v)} disabled={loadState !== 'ready'}>
                {editorOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
              </button>
            )}
            {canEdit && (viewMode === 'overview' || viewMode === 'operations') && (
              <button className="button secondary" type="button" onClick={() => openAiAssistant('organization_chart')}>
                <Bot size={14} />
                Ask AI
              </button>
            )}
            {viewMode === 'operations' && (
              <>
                <label className="inline-select">
                  Select Crew Director
                  <select value={selectedDirector} onChange={(e) => {
                    setSelectedDirector(e.target.value)
                    setSelectedOps('')
                    setSelectedCrewManager('')
                  }}>
                    <option value="">Select a Crew Director</option>
                    {data.crewDirectors.map((director) => (
                      <option key={director.id} value={director.id}>
                        {director.person.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inline-select">
                  Select Crew Operations Manager
                  <select value={selectedOps} onChange={(e) => {
                    setSelectedOps(e.target.value)
                    setSelectedCrewManager('')
                  }} disabled={!selectedDirector || !operationsManagersForDirector.length}>
                    <option value="">{selectedDirector ? 'Select a Crew Operations Manager' : 'Select a Crew Director first'}</option>
                    {operationsManagersForDirector.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.person.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inline-select">
                  Select Crew Manager
                  <select value={selectedCrewManager} onChange={(e) => setSelectedCrewManager(e.target.value)} disabled={!selectedOperationsManager}>
                    <option value="">{selectedOperationsManager ? 'All Crew Managers' : 'Select a Crew Operations Manager first'}</option>
                    {selectedCrewManagers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.person.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {viewMode === 'overview' && !!data.crewDirectors.length && (
              <label className="inline-select">
                Select Crew Director
                <select value={selectedDirector} onChange={(e) => setSelectedDirector(e.target.value)}>
                  <option value="">All Crew Directors</option>
                  {data.crewDirectors.map((director) => (
                    <option key={director.id} value={director.id}>
                      {director.person.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {viewMode === 'vessels' && (
              <label className="inline-select inline-title">
                <strong>{APP_NAME}</strong>
                <small>Live vessel database view</small>
              </label>
            )}
            {canEdit && viewMode === 'vessels' && (
              <button className="button secondary" type="button" onClick={() => openAiAssistant('vessel_master')}>
                <Bot size={14} />
                Ask AI
              </button>
            )}
            {(viewMode === 'overview' || viewMode === 'operations') && (
              <div className="zoom-controls">
                <button className="button secondary" onClick={() => setChartZoom(1)} disabled={loadState !== 'ready'}>Fit team</button>
                <button className="button secondary" onClick={() => setChartZoom((value) => Math.max(0.8, Number((value - 0.1).toFixed(2))))} disabled={loadState !== 'ready'}>Zoom out</button>
                <button className="button secondary" onClick={() => setChartZoom((value) => Math.min(1.35, Number((value + 0.1).toFixed(2))))} disabled={loadState !== 'ready'}>Zoom in</button>
                <button className="button secondary" onClick={() => setChartZoom(1)} disabled={loadState !== 'ready'}>Reset view</button>
              </div>
            )}
            {readOnly && <span className="read-only-pill">Read-only access</span>}
            <span className="zoom-label">{viewMode === 'dashboard' ? 'Connected workspace' : viewMode === 'access' ? 'Administrator workspace' : `Presentation workspace · ${Math.round(chartZoom * 100)}%`}</span>
          </div>
          {viewMode === 'dashboard' ? (
            <DashboardPage />
          ) : viewMode === 'ai' ? (
            <AiAssistantPage user={user} initialScope={aiInitialScope} />
          ) : viewMode === 'access' ? (
            canAdmin ? <AdminAccessRequests /> : <AccessDeniedPage />
          ) : viewMode === 'vessels' ? (
            <VesselMasterTable canEdit={canEdit} />
          ) : (
            <div className={`canvas-stage ${readOnly ? 'canvas-stage-readonly' : ''}`}>
              <div className="presentation-viewport" style={{ zoom: chartZoom }}>
              <div className={`presentation-frame view-${viewMode}`}>
                <ChartErrorBoundary onRetry={() => void refreshPageData()}>
                {viewMode === 'overview' ? (
                  <OrgChartView selectedDirectorId={selectedDirector} />
                ) : (
                  <OperationsAllocationView crewDirectorId={selectedDirector} operationsManagerId={selectedOps} crewManagerId={selectedCrewManager} />
                )}
                </ChartErrorBoundary>
              </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
