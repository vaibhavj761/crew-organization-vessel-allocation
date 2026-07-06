import { useState } from 'react'
import { apiClient } from '../api/client'

export function SetPasswordPage({ token, onDone, title, endpoint, message }: { token: string; onDone: () => void; title: string; endpoint: '/api/auth/set-password' | '/api/auth/reset-password'; message?: string }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }
    setLoading(true)
    setError('')
    try {
      await apiClient.request(endpoint, {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      })
      setDone('Password saved successfully. You can now return to sign in.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password update failed')
    } finally {
      setLoading(false)
    }
  }

  return <div className="login-page"><form className="login-card login-card-wide" onSubmit={submit}><h1>{title}</h1><p>Create your permanent password to continue.</p>{message && <p className="helper-copy">{message}</p>}<p className="helper-copy">Use at least 8 characters. This link is one-time use and expires automatically.</p><label className="field"><span>New password</span><input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} /></label><label className="field"><span>Confirm password</span><input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} /></label>{done && <p className="form-success">{done}</p>}{error && <p className="form-error">{error}</p>}<button className="button" disabled={loading}>{loading ? 'Saving…' : 'Save password'}</button>{done && <button type="button" className="button secondary" onClick={onDone}>Back to sign in</button>}</form></div>
}
