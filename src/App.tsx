import { useEffect, useState } from 'react'
import { authApi } from './api/auth'
import { ApiError } from './api/client'
import { LoginPage } from './components/LoginPage'
import { AppShell } from './components/AppShell'
import type { SafeUser, ViewMode } from './types'
import { RequestAccessPage } from './components/RequestAccessPage'
import { ForgotPasswordPage } from './components/ForgotPasswordPage'
import { SetPasswordPage } from './components/SetPasswordPage'

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('overview')
  const [user, setUser] = useState<SafeUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [authView, setAuthView] = useState<'login' | 'request-access' | 'forgot-password'>('login')
  const [showAdminRequests, setShowAdminRequests] = useState(false)
  const url = new URL(window.location.href)
  const pathname = url.pathname
  const token = url.searchParams.get('token') || ''

  const loadMe = async () => {
    setLoading(true)
    setAuthError('')
    try {
      const response = await authApi.me()
      setUser(response.user)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null)
      } else {
        setAuthError(error instanceof Error ? error.message : 'Unable to reach the server')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMe()
  }, [])

  if (loading) {
    return <div className="login-page"><div className="login-card"><h1>Loading…</h1><p>{authError || 'Checking your session'}</p></div></div>
  }

  if (!user) {
    if (pathname === '/set-password' && token) {
      return <SetPasswordPage token={token} title="Set password" endpoint="/api/auth/set-password" onDone={() => window.history.replaceState({}, '', '/')} />
    }
    if (pathname === '/reset-password' && token) {
      return <SetPasswordPage token={token} title="Reset password" endpoint="/api/auth/reset-password" onDone={() => window.history.replaceState({}, '', '/')} />
    }
    if (authView === 'request-access') {
      return <RequestAccessPage onBack={() => setAuthView('login')} />
    }
    if (authView === 'forgot-password') {
      return <ForgotPasswordPage onBack={() => setAuthView('login')} />
    }
    return <LoginPage onLogin={(nextUser) => setUser(nextUser)} onRequestAccess={() => setAuthView('request-access')} onForgotPassword={() => setAuthView('forgot-password')} />
  }

  const canEdit = user.role === 'ADMIN' || user.role === 'EDITOR'

  return (
    <AppShell
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      user={user}
      canEdit={canEdit}
      onRefresh={loadMe}
      onLogout={() => setUser(null)}
      showAdminRequests={showAdminRequests}
      onToggleAdminRequests={() => setShowAdminRequests((value) => !value)}
    />
  )
}
