import { LogOut, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'
import { authApi } from '../api/auth'
import type { SafeUser } from '../types'
import { getRoleLabel } from '../utils/roles'
import { AccountSettingsDialog } from './AccountSettingsDialog'

export function AuthShell({ user, onLogout, onRefresh }: { user: SafeUser; onLogout: () => void | Promise<void>; onRefresh: () => void | Promise<void> }) {
  const [error, setError] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const logout = async () => {
    try {
      await authApi.logout()
      await onLogout()
    } catch {
      setError('Logout failed')
    }
  }
  useEffect(() => setError(''), [user])
  return <div className="auth-shell"><div className="auth-user"><strong>{user.name}</strong><span>{getRoleLabel(user.role)} · {user.status.replaceAll('_',' ')}</span>{user.role === 'VIEWER' || user.role === 'BOSS_VIEWER' ? <em>Read-only access</em> : null}{error && <small>{error}</small>}</div><button className="icon-button" onClick={() => setSettingsOpen(true)} title="Account settings" aria-label="Account settings"><Settings size={16} /></button><button className="icon-button" onClick={logout} title="Log out"><LogOut size={16} /></button>{settingsOpen ? <AccountSettingsDialog user={user} onClose={() => setSettingsOpen(false)} onUpdated={onRefresh} /> : null}</div>
}
