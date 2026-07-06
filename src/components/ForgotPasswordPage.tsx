import { useState } from 'react'
import { apiClient } from '../api/client'

export function ForgotPasswordPage({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [resetLink, setResetLink] = useState('')
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      const response = await apiClient.request<{ message: string; resetLink?: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setMessage(response.message)
      setResetLink(response.resetLink || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    }
  }

  return <div className="login-page"><form className="login-card" onSubmit={submit}><h1>Forgot password</h1><p>Request a password reset for an active account.</p><label className="field"><span>Email</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} /></label>{message && <p>{message}</p>}{resetLink && <p className="helper-copy">Development reset link: {resetLink}</p>}{error && <p className="form-error">{error}</p>}<button className="button">Request reset</button><button type="button" className="button secondary" onClick={onBack}>Back to login</button></form></div>
}
