import { Check, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useChart } from '../state/ChartContext'
import type { SafeUser, ViewMode } from '../types'
import { EditorPanel } from './EditorPanel'
import { ExportToolbar } from './ExportToolbar'
import { OrgChartView } from './OrgChartView'
import { OperationsDetailView } from './OperationsDetailView'
import { VesselAllocationView } from './VesselAllocationView'
import { VesselMasterTable } from './VesselMasterTable'
import { AuthShell } from './AuthShell'
import { AdminAccessRequests } from './AdminAccessRequests'

export function AppShell({
  viewMode,
  onViewModeChange,
  user,
  canEdit,
  onRefresh,
  onLogout,
  showAdminRequests,
  onToggleAdminRequests,
}: {
  viewMode: ViewMode
  onViewModeChange: (m: ViewMode) => void
  user: SafeUser
  canEdit: boolean
  onRefresh: () => void
  onLogout: () => void | Promise<void>
  showAdminRequests: boolean
  onToggleAdminRequests: () => void
}) {
  const { data, saveState, errorMessage } = useChart()
  const [editorOpen, setEditorOpen] = useState(true)
  const [selectedOps, setSelectedOps] = useState(data.operationsManagers[0]?.id || '')

  useEffect(() => {
    if (!data.operationsManagers.some((op) => op.id === selectedOps)) {
      setSelectedOps(data.operationsManagers[0]?.id || '')
    }
  }, [data.operationsManagers, selectedOps])

  const modes: [ViewMode, string][] = [
    ['overview', 'Organization'],
    ['detail', 'Operations detail'],
    ['allocation', 'Vessel allocation'],
    ['vessels', 'Vessel master'],
  ]

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
          {user.role === 'ADMIN' && <button className="button secondary" onClick={onToggleAdminRequests}>{showAdminRequests ? 'Close requests' : 'Access requests'}</button>}
          <span className={`save-state ${saveState === 'error' ? 'save-error' : ''}`} title={errorMessage || undefined}>
            <Check size={14} />
            {saveState === 'saved' ? 'Loaded from server' : saveState === 'saving' ? 'Saving…' : errorMessage || 'Could not sync'}
          </span>
          {viewMode !== 'vessels' && <ExportToolbar viewMode={viewMode} selectedOperationsManagerId={selectedOps} />}
        </div>
      </header>
      <main className="workspace">
        {canEdit && editorOpen && <EditorPanel />}
        <section className="canvas-workspace">
          {showAdminRequests ? <AdminAccessRequests /> : null}
          <div className="canvas-toolbar">
            {canEdit && (
              <button className="icon-button" onClick={() => setEditorOpen((v) => !v)}>
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
            {!canEdit && <span className="read-only-pill">Read-only access</span>}
            <span className="zoom-label">16:9 presentation preview</span>
          </div>
          {viewMode === 'vessels' ? (
            <VesselMasterTable />
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
