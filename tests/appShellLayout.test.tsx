import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '../src/components/AppShell'
import type { SafeUser, ViewMode } from '../src/types'

const { refreshWorkspaceDataMock, saveChangesMock } = vi.hoisted(() => ({
  refreshWorkspaceDataMock: vi.fn(),
  saveChangesMock: vi.fn(),
}))

vi.mock('../src/state/ChartContext', () => ({
  useChart: () => ({
    data: {
      schemaVersion: 2,
      title: 'Crew Operations Organization Chart',
      organizationName: 'Northstar Maritime',
      effectiveDate: '2026-07-01',
      crewDirectors: [],
      operationsManagers: [],
      vessels: [],
      footerText: 'Internal',
    },
    saveState: 'saved',
    hasUnsavedChanges: false,
    errorMessage: '',
    syncNotice: '',
    saveChanges: saveChangesMock,
    loadState: 'ready',
    refreshWorkspaceData: refreshWorkspaceDataMock,
  }),
}))

vi.mock('../src/components/AuthShell', () => ({
  AuthShell: ({ user }: { user: SafeUser }) => <div>AuthShell {user.role}</div>,
}))

vi.mock('../src/components/EditorPanel', () => ({
  EditorPanel: () => <div>Editor Panel</div>,
}))

vi.mock('../src/components/ExportToolbar', () => ({
  ExportToolbar: () => <div>Export Toolbar</div>,
}))

vi.mock('../src/components/DashboardPage', () => ({
  DashboardPage: () => <div>Dashboard Content</div>,
}))

vi.mock('../src/components/OrgChartView', () => ({
  OrgChartView: () => <div>Organization Chart</div>,
}))

vi.mock('../src/components/OperationsAllocationView', () => ({
  OperationsAllocationView: () => <div>Operations Allocation</div>,
}))

vi.mock('../src/components/VesselMasterTable', () => ({
  VesselMasterTable: () => <div>Vessel Master</div>,
}))

vi.mock('../src/components/AdminAccessRequests', () => ({
  AdminAccessRequests: () => <div>Access Management</div>,
}))

function makeUser(role: SafeUser['role']): SafeUser {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    role,
    status: 'ACTIVE',
    isActive: true,
    lastLoginAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  }
}

function renderShell(role: SafeUser['role'], viewMode: ViewMode = 'dashboard') {
  return render(
    <AppShell
      viewMode={viewMode}
      onViewModeChange={vi.fn()}
      user={makeUser(role)}
      canEdit={role === 'ADMIN' || role === 'EDITOR'}
      canAdmin={role === 'ADMIN'}
      onRefresh={vi.fn()}
      onLogout={vi.fn()}
    />,
  )
}

describe('AppShell role layout', () => {
  beforeEach(() => {
    refreshWorkspaceDataMock.mockClear()
    saveChangesMock.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('refreshes once on manual refresh and once on navigation click only', () => {
    renderShell('ADMIN', 'dashboard')

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(refreshWorkspaceDataMock).toHaveBeenCalledWith('manual-refresh')

    fireEvent.click(screen.getByRole('button', { name: 'Organization Chart' }))
    expect(refreshWorkspaceDataMock).toHaveBeenCalledWith('nav-click-organization')
    expect(refreshWorkspaceDataMock).toHaveBeenCalledTimes(2)
  })

  it('does not refresh on passive interaction like mousemove or scroll', () => {
    renderShell('VIEWER', 'dashboard')

    fireEvent.mouseMove(window)
    fireEvent.scroll(window)

    expect(refreshWorkspaceDataMock).not.toHaveBeenCalled()
  })

  it('uses expanded professional layout for read-only users without the editor sidebar', () => {
    const { container } = renderShell('VIEWER', 'overview')
    expect(container.firstElementChild).toHaveClass('editor-collapsed')
    expect(container.firstElementChild).toHaveClass('workspace-full')
    expect(screen.queryByText('Editor Panel')).not.toBeInTheDocument()
    expect(screen.getByText('Read-only access')).toBeInTheDocument()
    expect(container.querySelector('.canvas-workspace.full-width')).not.toBeNull()
    expect(container.querySelector('.presentation-viewport')).not.toBeNull()
    expect(container.querySelector('.presentation-frame.view-overview')).not.toBeNull()
  })

  it('keeps chart controls compact above the presentation canvas', () => {
    const { container } = renderShell('EDITOR', 'overview')

    expect(screen.getByRole('button', { name: 'Fit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument()
    expect(container.querySelector('.canvas-toolbar')).not.toBeNull()
    expect(container.querySelector('.canvas-stage')).not.toBeNull()
    expect(container.querySelector('.presentation-viewport')).not.toBeNull()
  })

  it('hides access management navigation for non-admin roles', () => {
    renderShell('BOSS_VIEWER', 'dashboard')
    expect(screen.queryByText('Access management')).not.toBeInTheDocument()
  })

  it('keeps access management full width for admins without showing the editor panel', () => {
    const { container } = renderShell('ADMIN', 'access')
    expect(container.firstElementChild).toHaveClass('editor-collapsed')
    expect(container.firstElementChild).toHaveClass('workspace-full')
    expect(screen.getAllByText('Access Management').length).toBeGreaterThan(0)
    expect(screen.queryByText('Editor Panel')).not.toBeInTheDocument()
  })

  it('does not refresh when typing in filter or form-like controls is not occurring', () => {
    renderShell('EDITOR', 'vessels')

    fireEvent.keyDown(window, { key: 'A' })
    fireEvent.pointerMove(window)

    expect(refreshWorkspaceDataMock).not.toHaveBeenCalled()
  })
})
