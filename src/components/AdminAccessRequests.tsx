import { Copy, Link2, RefreshCw, ShieldCheck, UserCheck, UserMinus, UserRoundCog } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiClient } from '../api/client'
import { copyTextToClipboard } from '../utils/clipboard'
import { getRoleLabel } from '../utils/roles'
import { PageHeader, StatusBadge } from './ui'

type Role = 'ADMIN' | 'EDITOR' | 'VIEWER' | 'BOSS_VIEWER'
type Status = 'PENDING_APPROVAL' | 'APPROVED_NEEDS_PASSWORD' | 'ACTIVE' | 'REJECTED' | 'DISABLED'

type RequestItem = {
  id: string
  name: string
  email: string
  department?: string | null
  accessRequestMessage?: string | null
  role: Role
  status: Status
  createdAt: string
  approvedAt?: string | null
  rejectedAt?: string | null
  lastLoginAt?: string | null
  isActive: boolean
}

const roleOptions: Array<{ value: Role; label: string; help: string }> = [
  { value: 'ADMIN', label: 'Admin', help: 'Full access including user and role management.' },
  { value: 'EDITOR', label: 'Editor', help: 'Can edit organization, hierarchy, vessels, and allocations.' },
  { value: 'VIEWER', label: 'Viewer', help: 'Read-only access to view, filter, and export.' },
  { value: 'BOSS_VIEWER', label: 'Viewer', help: 'Read-only access to view, filter, and export.' },
]

function friendlyRole(role: Role) {
  return roleOptions.find((item) => item.value === role)?.label || getRoleLabel(role)
}

function friendlyStatus(status: Status) {
  return status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : 'Not available'
}

async function copyText(value: string) {
  await copyTextToClipboard(value)
}

type AccessRefreshReason = 'page-open' | 'manual-refresh' | 'post-action'

export function AdminAccessRequests() {
  const [users, setUsers] = useState<RequestItem[]>([])
  const [roleDrafts, setRoleDrafts] = useState<Record<string, Role>>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [setupLink, setSetupLink] = useState('')
  const [busyId, setBusyId] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshNotice, setRefreshNotice] = useState('')
  const busyIdRef = useRef('')
  const hasUnsavedRoleDraftsRef = useRef(false)

  const hasUnsavedRoleDrafts = users.some((item) => (roleDrafts[item.id] || item.role) !== item.role)
  useEffect(() => {
    busyIdRef.current = busyId
  }, [busyId])
  useEffect(() => {
    hasUnsavedRoleDraftsRef.current = hasUnsavedRoleDrafts
  }, [hasUnsavedRoleDrafts])

  const load = useCallback(async (reason: AccessRefreshReason, fresh = true) => {
    if (busyIdRef.current) return
    if (reason !== 'post-action' && hasUnsavedRoleDraftsRef.current) {
      setRefreshNotice('New access-request data is available. Save or finish your role edits before refreshing.')
      return
    }
    setIsRefreshing(true)
    setError('')
    try {
      if (fresh) apiClient.clearGetRequestCache()
      const response = await apiClient.request<{ requests: RequestItem[] }>('/api/admin/access-requests', { fresh })
      setUsers(response.requests)
      setRoleDrafts(Object.fromEntries(response.requests.map((item) => [item.id, item.role || 'VIEWER'])))
      setRefreshNotice('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load access requests')
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load('page-open', true)
  }, [load])

  const grouped = useMemo(() => ({
    pending: users.filter((item) => item.status === 'PENDING_APPROVAL'),
    approved: users.filter((item) => item.status === 'APPROVED_NEEDS_PASSWORD'),
    active: users.filter((item) => item.status === 'ACTIVE'),
    disabled: users.filter((item) => item.status === 'DISABLED' || item.status === 'REJECTED'),
  }), [users])

  const approve = async (id: string) => {
    setBusyId(id)
    setError('')
    setMessage('')
    try {
      const response = await apiClient.request<{ setupLink: string; message: string }>('/api/admin/access-requests/' + id + '/approve', {
        method: 'POST',
        body: JSON.stringify({ role: roleDrafts[id] || 'VIEWER' }),
      })
      setSetupLink(response.setupLink)
      try {
        await copyText(response.setupLink)
        setMessage('Setup link copied.')
      } catch {
        setMessage('Access approved. Copy the setup link manually from the panel below.')
      }
      await load('post-action', true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed')
    } finally {
      setBusyId('')
    }
  }

  const reject = async (id: string) => {
    setBusyId(id)
    setError('')
    setMessage('')
    try {
      await apiClient.request('/api/admin/access-requests/' + id + '/reject', { method: 'POST', body: JSON.stringify({}) })
      setMessage('Access request rejected.')
      await load('post-action', true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rejection failed')
    } finally {
      setBusyId('')
    }
  }

  const regenerateLink = async (id: string) => {
    setBusyId(id)
    setError('')
    setMessage('')
    try {
      const response = await apiClient.request<{ setupLink: string; message: string }>('/api/admin/users/' + id + '/setup-link', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      setSetupLink(response.setupLink)
      try {
        await copyText(response.setupLink)
        setMessage('Setup/reset link copied.')
      } catch {
        setMessage('Setup/reset link generated. Copy it manually from the panel below.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate link')
    } finally {
      setBusyId('')
    }
  }

  const updateUser = async (id: string, payload: { role?: Role; status?: Extract<Status, 'ACTIVE' | 'DISABLED'> }) => {
    setBusyId(id)
    setError('')
    setMessage('')
    try {
      await apiClient.request('/api/admin/users/' + id, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      setMessage('User updated successfully.')
      await load('post-action', true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'User update failed')
    } finally {
      setBusyId('')
    }
  }

  const copyMessage = async () => {
    if (!setupLink) return
    setError('')
    try {
      await copyText(`Your access has been approved. Please set your password using this link: ${setupLink}`)
      setMessage('Setup message copied.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not copy automatically. Please copy the message manually.')
    }
  }

  return (
    <section className="admin-access-panel page-surface">
      <PageHeader eyebrow="Administration" title="Access Management" description="Review access requests, assign roles, and manage active user access." actions={<StatusBadge tone="info">Admin only</StatusBadge>} />
      <div className="editor-scroll admin-access-scroll">
        <div className="admin-summary-grid">
          <SummaryCard title="Pending Requests" count={grouped.pending.length} icon={<UserRoundCog size={16} />} />
          <SummaryCard title="Needs Password" count={grouped.approved.length} icon={<Link2 size={16} />} />
          <SummaryCard title="Active Users" count={grouped.active.length} icon={<UserCheck size={16} />} />
          <SummaryCard title="Disabled / Rejected" count={grouped.disabled.length} icon={<UserMinus size={16} />} />
        </div>

        <div className="backup-actions">
          <button className="button secondary" onClick={() => void load('manual-refresh', true)} disabled={isRefreshing || !!busyId}>
            <RefreshCw size={14} />
            {isRefreshing ? 'Refreshing…' : 'Refresh requests'}
          </button>
        </div>

        {setupLink && (
          <div className="admin-link-panel">
            <strong>Manual setup link</strong>
            <p>{setupLink}</p>
            <div className="backup-actions admin-link-actions">
              <button className="button secondary" onClick={() => void copyText(setupLink).then(() => setMessage('Copied.')).catch((err) => setError(err instanceof Error ? err.message : 'Could not copy automatically. Please copy the link manually.'))}><Copy size={14} /> Copy setup link</button>
              <button className="button secondary" onClick={() => void copyMessage()}><ShieldCheck size={14} /> Copy message text</button>
            </div>
          </div>
        )}

        {message && <p className="helper-copy admin-feedback ok">{message}</p>}
        {refreshNotice && <p className="helper-copy">{refreshNotice}</p>}
        {error && <p className="form-error">{error}</p>}

        <Section title="Pending Requests" items={grouped.pending} emptyText="No pending requests right now.">
          {(item) => (
            <UserCard
              item={item}
              roleDraft={roleDrafts[item.id] || 'VIEWER'}
              setRoleDraft={(role) => setRoleDrafts((current) => ({ ...current, [item.id]: role }))}
              busy={busyId === item.id}
              actions={
                <>
                  <button className="button secondary" onClick={() => void approve(item.id)} disabled={busyId === item.id}>Approve</button>
                  <button className="button ghost danger-text" onClick={() => void reject(item.id)} disabled={busyId === item.id}>Reject</button>
                </>
              }
            />
          )}
        </Section>

        <Section title="Approved / Needs Password" items={grouped.approved} emptyText="No approved users waiting for password setup.">
          {(item) => (
            <UserCard
              item={item}
              roleDraft={roleDrafts[item.id] || item.role}
              setRoleDraft={(role) => setRoleDrafts((current) => ({ ...current, [item.id]: role }))}
              busy={busyId === item.id}
              actions={
                <>
                  <button className="button secondary" onClick={() => void regenerateLink(item.id)} disabled={busyId === item.id}><RefreshCw size={14} /> New setup link</button>
                  <button className="button ghost" onClick={() => void updateUser(item.id, { role: roleDrafts[item.id] || item.role })} disabled={busyId === item.id}>Save role</button>
                  <button className="button ghost danger-text" onClick={() => void updateUser(item.id, { status: 'DISABLED' })} disabled={busyId === item.id}>Disable</button>
                </>
              }
            />
          )}
        </Section>

        <Section title="Active Users" items={grouped.active} emptyText="No active users found.">
          {(item) => (
            <UserCard
              item={item}
              roleDraft={roleDrafts[item.id] || item.role}
              setRoleDraft={(role) => setRoleDrafts((current) => ({ ...current, [item.id]: role }))}
              busy={busyId === item.id}
              actions={
                <>
                  <button className="button ghost" onClick={() => void updateUser(item.id, { role: roleDrafts[item.id] || item.role })} disabled={busyId === item.id}>Save role</button>
                  <button className="button secondary" onClick={() => void regenerateLink(item.id)} disabled={busyId === item.id}><Link2 size={14} /> Reset link</button>
                  <button className="button ghost danger-text" onClick={() => void updateUser(item.id, { status: 'DISABLED' })} disabled={busyId === item.id}>Disable</button>
                </>
              }
            />
          )}
        </Section>

        <Section title="Rejected / Disabled Users" items={grouped.disabled} emptyText="No rejected or disabled users.">
          {(item) => (
            <UserCard
              item={item}
              roleDraft={roleDrafts[item.id] || item.role}
              setRoleDraft={(role) => setRoleDrafts((current) => ({ ...current, [item.id]: role }))}
              busy={busyId === item.id}
              actions={
                item.status === 'DISABLED'
                  ? <button className="button secondary" onClick={() => void updateUser(item.id, { status: 'ACTIVE' })} disabled={busyId === item.id}>Enable</button>
                  : <button className="button secondary" onClick={() => void updateUser(item.id, { status: 'ACTIVE' })} disabled={busyId === item.id}>Re-activate</button>
              }
            />
          )}
        </Section>
      </div>
    </section>
  )
}

function SummaryCard({ title, count, icon }: { title: string; count: number; icon: React.ReactNode }) {
  return <div className="admin-summary-card"><span>{icon}</span><strong>{count}</strong><small>{title}</small></div>
}

function Section({ title, items, emptyText, children }: { title: string; items: RequestItem[]; emptyText: string; children: (item: RequestItem) => React.ReactNode }) {
  return (
    <section className="admin-section">
      <div className="subsection-heading spaced">
        <h4>{title}</h4>
        <span className="admin-count">{items.length}</span>
      </div>
      {items.length ? items.map(children) : <div className="editor-empty">{emptyText}</div>}
    </section>
  )
}

function UserCard({
  item,
  roleDraft,
  setRoleDraft,
  busy,
  actions,
}: {
  item: RequestItem
  roleDraft: Role
  setRoleDraft: (role: Role) => void
  busy: boolean
  actions: React.ReactNode
}) {
  return (
    <article className="admin-user-card">
      <div className="admin-user-card__top">
        <div>
          <strong>{item.name}</strong>
          <p>{item.email}{item.department ? ` · ${item.department}` : ''}</p>
        </div>
        <span className={`status-pill status-${item.status.toLowerCase()}`}>{friendlyStatus(item.status)}</span>
      </div>
      <p className="helper-copy">{item.accessRequestMessage || 'No request message provided.'}</p>
      <div className="admin-user-meta">
        <span>Assigned role: <strong>{friendlyRole(item.role)}</strong></span>
        <span>Requested: <strong>{formatDate(item.createdAt)}</strong></span>
        <span>Approved: <strong>{formatDate(item.approvedAt)}</strong></span>
        <span>Last login: <strong>{formatDate(item.lastLoginAt)}</strong></span>
      </div>
      <label className="field">
        <span>Role</span>
        <select value={roleDraft} onChange={(event) => setRoleDraft(event.target.value as Role)} disabled={busy}>
          {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <p className="helper-copy admin-role-help">{roleOptions.find((option) => option.value === roleDraft)?.help}</p>
      <div className="backup-actions admin-user-actions">{actions}</div>
    </article>
  )
}
