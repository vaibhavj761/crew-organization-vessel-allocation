import { useEffect, useState } from 'react'
import { authApi } from './api/auth'
import { ApiError } from './api/client'
import { LoginPage } from './components/LoginPage'
import { AppShell } from './components/AppShell'
import type { SafeUser, ViewMode } from './types'
import { RequestAccessPage } from './components/RequestAccessPage'
import { ForgotPasswordPage } from './components/ForgotPasswordPage'
import { SetPasswordPage } from './components/SetPasswordPage'
import { ChartProvider } from './state/ChartContext'

const publicRoutes = new Set(['/request-access', '/forgot-password', '/set-password', '/reset-password'])

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard')
  const [user, setUser] = useState<SafeUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [pathname, setPathname] = useState(window.location.pathname)
  const [token, setToken] = useState(new URL(window.location.href).searchParams.get('token') || '')

  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname)
      setToken(new URL(window.location.href).searchParams.get('token') || '')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = (nextPath: string, replace = false) => {
    const method = replace ? 'replaceState' : 'pushState'
    window.history[method]({}, '', nextPath)
    setPathname(window.location.pathname)
    setToken(new URL(window.location.href).searchParams.get('token') || '')
  }

  useEffect(() => {
    const routeMap: Record<string, ViewMode> = {
      '/': 'dashboard',
      '/organization': 'overview',
      '/operations-detail': 'detail',
      '/vessel-allocation': 'allocation',
      '/vessel-master': 'vessels',
      '/admin/access': 'access',
    }
    if (!publicRoutes.has(pathname)) {
      setViewMode(routeMap[pathname] || 'dashboard')
    }
  }, [pathname])

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

  if (pathname === '/set-password' && token) {
    return <SetPasswordPage token={token} title="Set password" endpoint="/api/auth/set-password" onDone={() => navigate(user ? '/' : '/', true)} message={user ? 'You are currently signed in. Completing this will set the password for the account linked to this setup link.' : undefined} />
  }
  if (pathname === '/reset-password' && token) {
    return <SetPasswordPage token={token} title="Reset password" endpoint="/api/auth/reset-password" onDone={() => navigate(user ? '/' : '/', true)} message={user ? 'You are currently signed in. Completing this will reset the password for the account linked to this reset link.' : undefined} />
  }
  if (pathname === '/request-access') {
    return <RequestAccessPage onBack={() => navigate(user ? '/' : '/', true)} />
  }
  if (pathname === '/forgot-password') {
    return <ForgotPasswordPage onBack={() => navigate(user ? '/' : '/', true)} />
  }

  if (!user) {
    return <LoginPage onLogin={(nextUser) => { setUser(nextUser); navigate(publicRoutes.has(pathname) ? '/' : pathname || '/', true) }} onRequestAccess={() => navigate('/request-access')} onForgotPassword={() => navigate('/forgot-password')} />
  }

  const canEdit = user.role === 'ADMIN' || user.role === 'EDITOR'
  const canAdmin = user.role === 'ADMIN'

  return (
    <ChartProvider key={user.id}>
      <AppShell
        viewMode={viewMode}
        onViewModeChange={(nextView) => {
          const pathByView: Record<ViewMode, string> = {
            dashboard: '/',
            overview: '/organization',
            detail: '/operations-detail',
            allocation: '/vessel-allocation',
            vessels: '/vessel-master',
            access: '/admin/access',
          }
          navigate(pathByView[nextView] || '/')
        }}
        user={user}
        canEdit={canEdit}
        canAdmin={canAdmin}
        onRefresh={loadMe}
        onLogout={() => { setUser(null); navigate('/', true) }}
      />
    </ChartProvider>
  )
}
