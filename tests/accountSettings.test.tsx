import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountSettingsDialog } from '../src/components/AccountSettingsDialog'
import type { SafeUser } from '../src/types'

const { updateProfile, changePassword } = vi.hoisted(() => ({ updateProfile: vi.fn(), changePassword: vi.fn() }))
vi.mock('../src/api/auth', () => ({ authApi: { updateProfile, changePassword } }))

const user: SafeUser = { id: 'user-1', name: 'Test User', email: 'test@example.com', role: 'EDITOR', status: 'ACTIVE', isActive: true, lastLoginAt: null, createdAt: '', updatedAt: '' }

describe('AccountSettingsDialog', () => {
  afterEach(cleanup)
  beforeEach(() => {
    updateProfile.mockReset().mockResolvedValue({ user })
    changePassword.mockReset().mockResolvedValue({ success: true })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('requires the current password before changing profile identity', () => {
    render(<AccountSettingsDialog user={user} onClose={vi.fn()} onUpdated={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Update profile' }))
    expect(screen.getByText('Enter your current password to update your profile.')).toBeInTheDocument()
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it('changes password only after matching confirmation', async () => {
    render(<AccountSettingsDialog user={user} onClose={vi.fn()} onUpdated={vi.fn()} />)
    const passwordFields = screen.getAllByLabelText(/password/i)
    fireEvent.change(passwordFields[1], { target: { value: 'Current-pass-1' } })
    fireEvent.change(passwordFields[2], { target: { value: 'New-pass-123' } })
    fireEvent.change(passwordFields[3], { target: { value: 'New-pass-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
    await waitFor(() => expect(changePassword).toHaveBeenCalledWith({ currentPassword: 'Current-pass-1', newPassword: 'New-pass-123' }))
  })
})
