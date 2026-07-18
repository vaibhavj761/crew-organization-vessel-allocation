import { useState } from 'react'
import { createPortal } from 'react-dom'
import { authApi } from '../api/auth'
import type { SafeUser } from '../types'

export function AccountSettingsDialog({ user, onClose, onUpdated }: { user: SafeUser; onClose: () => void; onUpdated: () => void | Promise<void> }) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [profilePassword, setProfilePassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState<'profile' | 'password' | ''>('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const saveProfile = async () => {
    const trimmedName = name.trim()
    const trimmedEmail = email.trim().toLowerCase()
    setError('')
    setMessage('')
    if (!trimmedName) return setError('Name is required.')
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) return setError('Enter a valid email address.')
    if (!profilePassword) return setError('Enter your current password to update your profile.')
    if (!window.confirm('Confirm this name and email update?')) return
    setBusy('profile')
    try {
      await authApi.updateProfile({ name: trimmedName, email: trimmedEmail, currentPassword: profilePassword })
      setProfilePassword('')
      setMessage('Profile updated successfully.')
      await onUpdated()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update your profile.')
    } finally {
      setBusy('')
    }
  }

  const savePassword = async () => {
    setError('')
    setMessage('')
    if (!currentPassword) return setError('Current password is required.')
    if (newPassword.length < 8) return setError('New password must be at least 8 characters.')
    if (newPassword !== confirmPassword) return setError('New passwords do not match.')
    if (currentPassword === newPassword) return setError('Choose a new password that is different from your current password.')
    if (!window.confirm('Confirm password change? Other signed-in sessions will be invalidated.')) return
    setBusy('password')
    try {
      await authApi.changePassword({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setMessage('Password changed successfully.')
      await onUpdated()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not change your password.')
    } finally {
      setBusy('')
    }
  }

  return createPortal(<div className="dialog-backdrop account-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
    <section className="dialog account-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="account-dialog-title">
      <div className="allocation-dialog__heading"><div><span>Your account</span><h3 id="account-dialog-title">Account settings</h3></div><button className="icon-button" onClick={onClose} disabled={!!busy} aria-label="Close account settings">×</button></div>
      <div className="account-settings-section">
        <div><strong>Profile</strong><p>Update your display name or sign-in email. Your current password confirms the change.</p></div>
        <div className="allocation-form-grid">
          <label className="field"><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} disabled={!!busy} /></label>
          <label className="field"><span>Email address</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={!!busy} /></label>
          <label className="field allocation-form-wide"><span>Current password</span><input type="password" value={profilePassword} onChange={(event) => setProfilePassword(event.target.value)} autoComplete="current-password" disabled={!!busy} /></label>
        </div>
        <button className="button" type="button" onClick={() => void saveProfile()} disabled={!!busy}>{busy === 'profile' ? 'Updating…' : 'Update profile'}</button>
      </div>
      <div className="account-settings-section">
        <div><strong>Password</strong><p>Use at least 8 characters. Changing it signs out your other sessions.</p></div>
        <div className="allocation-form-grid">
          <label className="field allocation-form-wide"><span>Current password</span><input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" disabled={!!busy} /></label>
          <label className="field"><span>New password</span><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" disabled={!!busy} /></label>
          <label className="field"><span>Confirm new password</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" disabled={!!busy} /></label>
        </div>
        <button className="button secondary" type="button" onClick={() => void savePassword()} disabled={!!busy}>{busy === 'password' ? 'Changing…' : 'Change password'}</button>
      </div>
      {message ? <p className="helper-copy admin-feedback ok" role="status">{message}</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="dialog-actions"><button className="button secondary" type="button" onClick={onClose} disabled={!!busy}>Close</button></div>
    </section>
  </div>, document.body)
}
