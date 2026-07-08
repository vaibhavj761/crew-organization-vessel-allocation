import { LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import { authApi } from '../api/auth'
import type { SafeUser } from '../types'
import { getRoleLabel } from '../utils/roles'

export function AuthShell({ user, onLogout }: { user: SafeUser; onLogout: () => void | Promise<void>; onRefresh: () => void }) {
  const [error, setError] = useState('')
  const logout = async () => {
    try {
      await authApi.logout()
      await onLogout()
    } catch {
      setError('Logout failed')
    }
  }
  useEffect(() => setError(''), [user])
  return <div className="auth-shell"><div className="auth-user"><strong>{user.name}</strong><span>{getRoleLabel(user.role)} · {user.status.replaceAll('_',' ')}</span>{user.role === 'VIEWER' || user.role === 'BOSS_VIEWER' ? <em>Read-only access</em> : null}{error && <small>{error}</small>}</div><button className="icon-button" onClick={logout} title="Log out"><LogOut size={16} /></button></div>
}
