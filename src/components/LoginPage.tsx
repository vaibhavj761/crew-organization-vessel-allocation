import { useState } from 'react'
import { authApi } from '../api/auth'
import type { SafeUser } from '../types'

export function LoginPage({ onLogin, onRequestAccess, onForgotPassword }: { onLogin: (user: SafeUser) => void; onRequestAccess: () => void; onForgotPassword: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await authApi.login(email, password)
      onLogin(response.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return <div className="login-page"><form className="login-card" onSubmit={submit}><div className="brand"><span className="brand-mark">CP</span><span><strong>Crew Planner</strong><small>Secure internal access</small></span></div><h1>Sign in</h1><p>Access the crew organization and vessel allocation workspace.</p><label className="field"><span>Email</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} /></label><label className="field"><span>Password</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} /></label>{error&&<p className="form-error">{error}</p>}<button className="button" disabled={loading}>{loading?'Signing in…':'Sign in'}</button><button type="button" className="button secondary" onClick={onRequestAccess}>Request access</button><button type="button" className="button ghost" onClick={onForgotPassword}>Forgot password?</button></form></div>
}
