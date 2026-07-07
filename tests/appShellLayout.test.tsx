import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppShell } from '../src/components/AppShell'
import type { SafeUser, ViewMode } from '../src/types'

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
    saveChanges: vi.fn(),
    loadState: 'ready',
    reloadFromServer: vi.fn(),
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
  it('uses expanded professional layout for read-only users without the editor sidebar', () => {
    const { container } = renderShell('VIEWER', 'overview')
    expect(container.firstElementChild).toHaveClass('editor-collapsed')
    expect(container.firstElementChild).toHaveClass('workspace-full')
    expect(screen.queryByText('Editor Panel')).not.toBeInTheDocument()
    expect(screen.getByText('Read-only access')).toBeInTheDocument()
  })

  it('hides access management navigation for non-admin roles', () => {
    renderShell('BOSS_VIEWER', 'dashboard')
    expect(screen.queryByText('Access management')).not.toBeInTheDocument()
  })

  it('keeps access management full width for admins without showing the editor panel', () => {
    const { container } = renderShell('ADMIN', 'access')
    expect(container.firstElementChild).toHaveClass('editor-collapsed')
    expect(container.firstElementChild).toHaveClass('workspace-full')
    expect(screen.getByText('Access Management')).toBeInTheDocument()
    expect(screen.queryByText('Editor Panel')).not.toBeInTheDocument()
  })
})
