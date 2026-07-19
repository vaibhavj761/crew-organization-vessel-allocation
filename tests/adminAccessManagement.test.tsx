import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminAccessRequests } from '../src/components/AdminAccessRequests'

const { requestMock, clearCacheMock, copyMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  clearCacheMock: vi.fn(),
  copyMock: vi.fn(),
}))

vi.mock('../src/api/client', () => ({
  apiClient: {
    request: requestMock,
    clearGetRequestCache: clearCacheMock,
  },
}))

vi.mock('../src/utils/clipboard', () => ({
  copyTextToClipboard: copyMock,
}))

describe('Admin access management', () => {
  beforeEach(() => {
    requestMock.mockReset()
    clearCacheMock.mockReset()
    copyMock.mockReset()
    copyMock.mockResolvedValue('clipboard')
    requestMock.mockImplementation(async (path: string) => {
      if (path === '/api/admin/users') {
        return { setupLink: 'http://localhost:5173/set-password?token=one-time-token', message: 'User created.' }
      }
      return { requests: [] }
    })
  })

  afterEach(() => cleanup())

  it('creates a user through the admin API and copies the one-time setup link', async () => {
    render(<AdminAccessRequests />)
    await screen.findByText('Create a new user')

    fireEvent.change(screen.getByLabelText(/User name/), { target: { value: '  New Editor  ' } })
    fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: '  NEW.EDITOR@EXAMPLE.COM  ' } })
    fireEvent.change(screen.getByLabelText(/^Role/), { target: { value: 'EDITOR' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create user & setup link' }))

    await waitFor(() => expect(requestMock).toHaveBeenCalledWith('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Editor', email: 'new.editor@example.com', role: 'EDITOR' }),
    }))
    expect(copyMock).toHaveBeenCalledWith('http://localhost:5173/set-password?token=one-time-token')
    expect(await screen.findByText('User created. One-time setup link copied.')).toBeInTheDocument()
  })

  it('blocks invalid details before calling the create API', async () => {
    render(<AdminAccessRequests />)
    await screen.findByText('Create a new user')

    fireEvent.change(screen.getByLabelText(/User name/), { target: { value: 'New Viewer' } })
    fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: 'not-an-email' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create user & setup link' }))

    expect(await screen.findByText('Enter a valid user email address.')).toBeInTheDocument()
    expect(requestMock).not.toHaveBeenCalledWith('/api/admin/users', expect.anything())
  })
})
