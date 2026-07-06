import { useState } from 'react'
import { apiClient } from '../api/client'

export function SetPasswordPage({ token, onDone, title, endpoint }: { token: string; onDone: () => void; title: string; endpoint: '/api/auth/set-password' | '/api/auth/reset-password' }) {
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
    setLoading(true)
    setError('')
    try {
      await apiClient.request(endpoint, {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      })
      setDone('Password saved successfully. You can now sign in.')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password update failed')
    } finally {
      setLoading(false)
    }
  }

  return <div className="login-page"><form className="login-card" onSubmit={submit}><h1>{title}</h1><p>Create your permanent password to continue.</p><label className="field"><span>New password</span><input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} /></label><label className="field"><span>Confirm password</span><input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} /></label>{done && <p>{done}</p>}{error && <p className="form-error">{error}</p>}<button className="button" disabled={loading}>{loading ? 'Saving…' : 'Save password'}</button></form></div>
}
