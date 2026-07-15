import { Bot, Check, Database, LayoutDashboard, Network, PanelLeftClose, PanelLeftOpen, RefreshCw, ShieldCheck, ShipWheel, Sparkles } from 'lucide-react'
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
  const [navigationOpen, setNavigationOpen] = useState(true)
  const [editorOpen, setEditorOpen] = useState(true)
  const [selectedOps, setSelectedOps] = useState('')
  const [selectedDirector, setSelectedDirector] = useState('')
  const [selectedDeputy, setSelectedDeputy] = useState('')
  const [selectedCrewManager, setSelectedCrewManager] = useState('')
  const [chartZoom, setChartZoom] = useState(1)
  const [aiInitialScope, setAiInitialScope] = useState<AiScope>('auto')
  const showEditorSidebar = canEdit && editorOpen && (viewMode === 'overview' || viewMode === 'operations')
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
    () => {
      const deputies = selectedOperationsManager?.deputyManagers || []
      const visibleDeputies = selectedDeputy ? deputies.filter((deputy) => deputy.id === selectedDeputy) : deputies
      return visibleDeputies.flatMap((deputy) => deputy.crewManagers)
    },
    [selectedDeputy, selectedOperationsManager],
  )
  const selectedDeputyManagers = useMemo(
    () => selectedOperationsManager?.deputyManagers || [],
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
      if (selectedDeputy) setSelectedDeputy('')
      if (selectedCrewManager) setSelectedCrewManager('')
      return
    }

    if (!operationsManagersForDirector.some((op) => op.id === selectedOps)) {
      setSelectedOps(operationsManagersForDirector[0]?.id || '')
      setSelectedDeputy('')
      setSelectedCrewManager('')
    }
  }, [operationsManagersForDirector, selectedDirector, selectedOps, selectedDeputy, selectedCrewManager])

  useEffect(() => {
    if (selectedDeputy && !selectedDeputyManagers.some((deputy) => deputy.id === selectedDeputy)) {
      setSelectedDeputy('')
      setSelectedCrewManager('')
    }
  }, [selectedDeputy, selectedDeputyManagers])

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
  }, [viewMode, selectedDirector, selectedOps, selectedDeputy, selectedCrewManager])

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

  const modes: Array<[ViewMode, string, typeof LayoutDashboard]> = [
    ['dashboard', 'Dashboard', LayoutDashboard],
    ['overview', 'Organization Chart', Network],
    ['operations', 'Operations & Vessel Allocation', ShipWheel],
    ['vessels', 'Vessel Master', Database],
  ]
  if (canEdit) modes.push(['ai', 'AI Assistant', Sparkles])
  if (canAdmin) modes.push(['access', 'Access management', ShieldCheck])

  const openAiAssistant = (scope: AiScope) => {
    setAiInitialScope(scope)
    handleViewModeChange('ai')
  }

  return (
    <div className={`app-shell ${navigationOpen ? '' : 'nav-collapsed'} ${showEditorSidebar ? '' : 'editor-collapsed workspace-full'} ${canEdit ? '' : 'read-only'}`}>
      <aside className="app-sidebar" aria-label="Primary navigation">
        <div className="brand">
          <span className="brand-mark">CO</span>
          <span>
            <strong>{APP_SHORT_NAME}</strong>
            <small>Crew operations</small>
          </span>
        </div>
        <div className="sidebar-section-label">Workspace</div>
        <nav className="view-switcher">
          {modes.map(([m, l, Icon]) => (
            <button key={m} className={viewMode === m ? 'active' : ''} onClick={() => handleViewModeChange(m)} aria-current={viewMode === m ? 'page' : undefined}>
              <Icon size={17} aria-hidden="true" />
              <span>{l}</span>
              {m === 'access' ? <small>Admin</small> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-footnote">
          <span className="sidebar-status-dot" />
          <div><strong>Live workspace</strong><small>PostgreSQL source of truth</small></div>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-header">
          <div className="topbar-title">
            <span>{APP_NAME}</span>
            <strong>{getPageTitle(viewMode).replace(` · ${APP_SHORT_NAME}`, '')}</strong>
          </div>
          <div className="header-actions">
            <button className="button secondary compact-button" type="button" onClick={() => setNavigationOpen((value) => !value)}>
              {navigationOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
              {navigationOpen ? 'Hide menu' : 'Show menu'}
            </button>
            {viewMode !== 'access' && viewMode !== 'ai' && (
              <button className="button secondary compact-button" onClick={() => void refreshPageData()} disabled={loadState !== 'ready' || saveState === 'saving'}>
                <RefreshCw size={14} />
                Refresh
              </button>
            )}
            {canEdit && viewMode !== 'access' && viewMode !== 'ai' && <button className="button compact-button" onClick={() => void saveChanges()} disabled={loadState !== 'ready' || saveState === 'saving' || !hasUnsavedChanges}>{saveState === 'saving' ? 'Saving…' : hasUnsavedChanges ? 'Save changes' : 'Saved'}</button>}
            {viewMode !== 'access' && viewMode !== 'ai' && (canEdit ? (
              <span className={`save-state ${saveState === 'error' ? 'save-error' : ''}`} title={errorMessage || undefined}>
                <Check size={14} />
                {saveState === 'saved' ? (hasUnsavedChanges ? 'Unsaved changes' : 'Saved to database') : saveState === 'saving' ? 'Saving…' : errorMessage || 'Could not sync'}
              </span>
            ) : (
              <span className="save-state read-only-state">
                <Check size={14} />
                {syncNotice || 'Read-only view'}
              </span>
            ))}
            {allowExport && (viewMode === 'overview' || viewMode === 'operations') && <ExportToolbar viewMode={viewMode} selectedOperationsManagerId={selectedOps} selectedCrewDirectorId={selectedDirector} selectedCrewManagerId={selectedCrewManager} />}
            <AuthShell user={user} onLogout={onLogout} onRefresh={onRefresh} />
          </div>
        </header>
        <main className="workspace">
        {showEditorSidebar && <EditorPanel selectedDirectorId={selectedDirector} selectedOperationsManagerId={selectedOps} selectedCrewManagerId={selectedCrewManager} />}
        <section className={`canvas-workspace view-${viewMode} ${showEditorSidebar ? 'with-editor' : 'full-width'}`}>
          {loadState === 'loading' && <div className="page-loading-banner">Loading latest database data…</div>}
          {syncNotice && <div className="page-loading-banner notice">{syncNotice}</div>}
          {(viewMode === 'overview' || viewMode === 'operations' || viewMode === 'vessels') ? <div className="canvas-toolbar">
            {canEdit && (viewMode === 'overview' || viewMode === 'operations') && (
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
                    setSelectedDeputy('')
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
                    setSelectedDeputy('')
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
                  Select Deputy Manager
                  <select value={selectedDeputy} onChange={(e) => {
                    setSelectedDeputy(e.target.value)
                    setSelectedCrewManager('')
                  }} disabled={!selectedOperationsManager || !selectedDeputyManagers.length}>
                    <option value="">{selectedOperationsManager ? 'All Deputy Managers' : 'Select a Crew Operations Manager first'}</option>
                    {selectedDeputyManagers.map((deputy) => (
                      <option key={deputy.id} value={deputy.id}>
                        {deputy.person.name}
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
                <button className="button secondary" onClick={() => setChartZoom(1)} disabled={loadState !== 'ready'}>Fit</button>
                <button className="button secondary" onClick={() => setChartZoom((value) => Math.max(0.8, Number((value - 0.1).toFixed(2))))} disabled={loadState !== 'ready'}>Zoom out</button>
                <button className="button secondary" onClick={() => setChartZoom((value) => Math.min(1.35, Number((value + 0.1).toFixed(2))))} disabled={loadState !== 'ready'}>Zoom in</button>
                <button className="button secondary" onClick={() => setChartZoom(1)} disabled={loadState !== 'ready'}>Reset</button>
              </div>
            )}
            {readOnly && <span className="read-only-pill">Read-only access</span>}
            <span className="zoom-label">{viewMode === 'vessels' ? 'Live database workspace' : `Presentation workspace · ${Math.round(chartZoom * 100)}%`}</span>
          </div> : null}
          {viewMode === 'dashboard' ? (
            <DashboardPage user={user} onNavigate={handleViewModeChange} />
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
                  <OperationsAllocationView crewDirectorId={selectedDirector} operationsManagerId={selectedOps} deputyManagerId={selectedDeputy} crewManagerId={selectedCrewManager} />
                )}
                </ChartErrorBoundary>
              </div>
              </div>
            </div>
          )}
        </section>
        </main>
      </div>
    </div>
  )
}
