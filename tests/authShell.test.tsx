import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthShell } from '../src/components/AuthShell'
import type { SafeUser } from '../src/types'

vi.mock('../src/api/auth', () => ({
  authApi: {
    logout: vi.fn().mockResolvedValue(undefined),
  },
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

describe('AuthShell role display', () => {
  it('renders Viewer as read-only access', () => {
    render(<AuthShell user={makeUser('VIEWER')} onLogout={vi.fn()} onRefresh={vi.fn()} />)
    expect(screen.getByText('VIEWER · ACTIVE')).toBeInTheDocument()
    expect(screen.getByText('Read-only access')).toBeInTheDocument()
  })
})
