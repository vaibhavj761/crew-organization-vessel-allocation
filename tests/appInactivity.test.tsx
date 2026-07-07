import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SafeUser } from '../src/types'

const { authApiMock } = vi.hoisted(() => ({
  authApiMock: {
    me: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
}))

const mockUser: SafeUser = {
  id: 'user-1',
  name: 'Admin User',
  email: 'admin@example.com',
  role: 'ADMIN',
  status: 'ACTIVE',
  isActive: true,
  lastLoginAt: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
}

vi.mock('../src/api/auth', () => ({
  authApi: authApiMock,
}))

vi.mock('../src/state/ChartContext', () => ({
  ChartProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('../src/components/AppShell', () => ({
  AppShell: ({ user, onUnsavedChangesChange }: { user: SafeUser; onUnsavedChangesChange?: (value: boolean) => void }) => {
    useEffect(() => {
      onUnsavedChangesChange?.(false)
    }, [onUnsavedChangesChange])
    return <div>App shell for {user.name}</div>
  },
}))

import App from '../src/App'

describe('App inactivity logout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    authApiMock.me.mockResolvedValue({ user: mockUser })
    authApiMock.logout.mockResolvedValue({ success: true })
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    cleanup()
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('shows a warning and logs out after 10 minutes of real inactivity', async () => {
    render(<App />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByText('App shell for Admin User')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(9 * 60 * 1000 + 1000)
      await Promise.resolve()
    })
    expect(screen.getByText('Stay signed in?')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(60 * 1000)
      await Promise.resolve()
    })

    expect(authApiMock.logout).toHaveBeenCalledTimes(1)
    expect(screen.getByText('You were logged out after 10 minutes of inactivity.')).toBeInTheDocument()
    expect(screen.getAllByText('Sign in').length).toBeGreaterThan(0)
  }, 10000)

  it('resets the timer only on real user activity', async () => {
    render(<App />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByText('App shell for Admin User')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(8 * 60 * 1000)
      await Promise.resolve()
    })
    fireEvent.mouseMove(window)

    await act(async () => {
      vi.advanceTimersByTime(2 * 60 * 1000)
      await Promise.resolve()
    })

    expect(screen.queryByText('Stay signed in?')).not.toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(7 * 60 * 1000 + 1000)
      await Promise.resolve()
    })

    expect(screen.getByText('Stay signed in?')).toBeInTheDocument()
  }, 10000)
})
