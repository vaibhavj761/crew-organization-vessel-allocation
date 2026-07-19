import { useEffect, useRef, useState } from 'react'
import { APP_SHORT_NAME, getPageTitle } from './constants/app'
import { authApi } from './api/auth'
import { ApiError } from './api/client'
import { LoginPage } from './components/LoginPage'
import { AppShell } from './components/AppShell'
import type { SafeUser, ViewMode } from './types'
import { ForgotPasswordPage } from './components/ForgotPasswordPage'
import { SetPasswordPage } from './components/SetPasswordPage'
import { ChartProvider } from './state/ChartContext'
import { canEditChart, canManageAccess } from './utils/permissions'

const publicRoutes = new Set(['/forgot-password', '/set-password', '/reset-password'])
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000
const WARNING_TIMEOUT_MS = 9 * 60 * 1000

function InactivityDialog({
  onStaySignedIn,
  hasUnsavedChanges,
}: {
  onStaySignedIn: () => void
  hasUnsavedChanges: boolean
}) {
  return (
    <div className="dialog-backdrop">
      <div className="dialog">
        <h3>Stay signed in?</h3>
        <p>You will be logged out in 1 minute due to inactivity.{hasUnsavedChanges ? ' Unsaved changes may be lost.' : ''}</p>
        <div className="dialog-actions">
          <button className="button" onClick={onStaySignedIn}>Stay signed in</button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard')
  const [user, setUser] = useState<SafeUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [loginNotice, setLoginNotice] = useState('')
  const [pathname, setPathname] = useState(window.location.pathname)
  const [token, setToken] = useState(new URL(window.location.href).searchParams.get('token') || '')
  const [showInactivityWarning, setShowInactivityWarning] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const lastActivityAtRef = useRef(Date.now())
  const logoutInFlightRef = useRef(false)

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
    if (pathname === '/request-access') {
      navigate('/', true)
      return
    }
    if (pathname === '/operations-detail' || pathname === '/vessel-allocation') {
      navigate('/operations-allocation', true)
      return
    }

    const routeMap: Record<string, ViewMode> = {
      '/': 'dashboard',
      '/organization': 'overview',
      '/operations-allocation': 'operations',
      '/vessel-master': 'vessels',
      '/ai-assistant': 'ai',
      '/admin/access': 'access',
    }

    if (!publicRoutes.has(pathname)) {
      const nextView = routeMap[pathname] || 'dashboard'
      setViewMode(nextView)
      document.title = getPageTitle(nextView)
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
        if (error.message && error.message !== 'Not authenticated') {
          setLoginNotice(error.message)
        }
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

  useEffect(() => {
    const handleAuthInvalidated = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail
      setUser(null)
      setHasUnsavedChanges(false)
      setShowInactivityWarning(false)
      setLoginNotice(detail?.message || 'Your session expired. Please sign in again.')
      navigate('/', true)
    }

    window.addEventListener('crew-auth-invalidated', handleAuthInvalidated as EventListener)
    return () => window.removeEventListener('crew-auth-invalidated', handleAuthInvalidated as EventListener)
  }, [])

  useEffect(() => {
    if (!user) {
      setShowInactivityWarning(false)
      return
    }

    lastActivityAtRef.current = Date.now()
    setShowInactivityWarning(false)

    const markActivity = () => {
      lastActivityAtRef.current = Date.now()
      setShowInactivityWarning(false)
    }

    const onActivity = () => markActivity()
    const events: Array<keyof WindowEventMap> = ['mousemove', 'click', 'keydown', 'scroll', 'touchstart', 'pointerdown', 'pointermove']
    events.forEach((name) => window.addEventListener(name, onActivity, { passive: true }))

    const interval = window.setInterval(async () => {
      const inactiveFor = Date.now() - lastActivityAtRef.current
      if (inactiveFor >= INACTIVITY_TIMEOUT_MS && !logoutInFlightRef.current) {
        logoutInFlightRef.current = true
        try {
          await authApi.logout().catch(() => null)
        } finally {
          setUser(null)
          setHasUnsavedChanges(false)
          setShowInactivityWarning(false)
          setLoginNotice('You were logged out after 10 minutes of inactivity.')
          navigate('/', true)
          logoutInFlightRef.current = false
        }
        return
      }

      if (inactiveFor >= WARNING_TIMEOUT_MS) {
        setShowInactivityWarning(true)
      }
    }, 15000)

    return () => {
      window.clearInterval(interval)
      events.forEach((name) => window.removeEventListener(name, onActivity))
    }
  }, [user])

  if (loading) {
    return <div className="login-page"><div className="login-card"><h1>Loading…</h1><p>{authError || `Checking your ${APP_SHORT_NAME} session`}</p></div></div>
  }

  if (pathname === '/set-password' && token) {
    return <SetPasswordPage token={token} title="Set password" endpoint="/api/auth/set-password" onDone={() => navigate('/', true)} message={user ? 'You are currently signed in. Completing this will set the password for the account linked to this setup link.' : undefined} />
  }
  if (pathname === '/reset-password' && token) {
    return <SetPasswordPage token={token} title="Reset password" endpoint="/api/auth/reset-password" onDone={() => navigate('/', true)} message={user ? 'You are currently signed in. Completing this will reset the password for the account linked to this reset link.' : undefined} />
  }
  if (pathname === '/forgot-password') {
    return <ForgotPasswordPage onBack={() => navigate(user ? '/' : '/', true)} />
  }

  if (!user) {
    return <LoginPage notice={loginNotice} onLogin={(nextUser) => { setUser(nextUser); setLoginNotice(''); navigate(publicRoutes.has(pathname) ? '/' : pathname || '/', true) }} onForgotPassword={() => navigate('/forgot-password')} />
  }

  const canEdit = canEditChart(user)
  const canAdmin = canManageAccess(user)

  return (
    <>
      <ChartProvider key={user.id}>
        <AppShell
          viewMode={viewMode}
          onViewModeChange={(nextView) => {
            const pathByView: Record<ViewMode, string> = {
              dashboard: '/',
              overview: '/organization',
              operations: '/operations-allocation',
              vessels: '/vessel-master',
              ai: '/ai-assistant',
              access: '/admin/access',
            }
            navigate(pathByView[nextView] || '/')
          }}
          user={user}
          canEdit={canEdit}
          canAdmin={canAdmin}
          onRefresh={loadMe}
          onLogout={() => { setUser(null); setHasUnsavedChanges(false); navigate('/', true) }}
          onUnsavedChangesChange={setHasUnsavedChanges}
        />
      </ChartProvider>
      {showInactivityWarning ? <InactivityDialog hasUnsavedChanges={hasUnsavedChanges} onStaySignedIn={() => { lastActivityAtRef.current = Date.now(); setShowInactivityWarning(false) }} /> : null}
    </>
  )
}
