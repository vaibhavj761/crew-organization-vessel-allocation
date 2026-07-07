import { useState } from 'react'
import { APP_NAME, APP_SHORT_NAME, APP_SUBTITLE } from '../constants/app'
import type { SafeUser } from '../types'
import { authApi } from '../api/auth'

export function LoginPage({
  onLogin,
  onRequestAccess,
  onForgotPassword,
  notice = '',
}: {
  onLogin: (user: SafeUser) => void
  onRequestAccess: () => void
  onForgotPassword: () => void
  notice?: string
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await authApi.login(email, password)
      onLogin(response.user)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Login failed. Please check your password or account status.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="brand">
          <span className="brand-mark">CO</span>
          <span>
            <strong>{APP_SHORT_NAME}</strong>
            <small>{APP_NAME}</small>
          </span>
        </div>
        <h1>Sign in</h1>
        <p>{APP_SUBTITLE}</p>
        {notice ? <p className="form-success">{notice}</p> : null}
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="button" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
        <button type="button" className="button secondary" onClick={onRequestAccess}>Request access</button>
        <button type="button" className="button ghost" onClick={onForgotPassword}>Forgot password?</button>
      </form>
    </div>
  )
}
