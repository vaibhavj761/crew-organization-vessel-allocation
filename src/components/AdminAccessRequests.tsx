import { Copy, Link2, Plus, RefreshCw, ShieldCheck, UserCheck, UserMinus, UserPlus, UserRoundCog } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiClient } from '../api/client'
import { copyTextToClipboard } from '../utils/clipboard'
import { getRoleLabel } from '../utils/roles'
import { PageHeader, StatusBadge } from './ui'

type Role = 'ADMIN' | 'EDITOR' | 'VIEWER'
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
  const [identityDrafts, setIdentityDrafts] = useState<Record<string, { name: string; email: string }>>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [setupLink, setSetupLink] = useState('')
  const [busyId, setBusyId] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshNotice, setRefreshNotice] = useState('')
  const [newUser, setNewUser] = useState<{ name: string; email: string; role: Role }>({ name: '', email: '', role: 'VIEWER' })
  const busyIdRef = useRef('')
  const hasUnsavedDraftsRef = useRef(false)

  const hasUnsavedDrafts = users.some((item) => {
    const identity = identityDrafts[item.id]
    return (roleDrafts[item.id] || item.role) !== item.role || !!identity && (identity.name !== item.name || identity.email !== item.email)
  })
  useEffect(() => {
    busyIdRef.current = busyId
  }, [busyId])
  useEffect(() => {
    hasUnsavedDraftsRef.current = hasUnsavedDrafts
  }, [hasUnsavedDrafts])

  const load = useCallback(async (reason: AccessRefreshReason, fresh = true) => {
    if (busyIdRef.current && reason !== 'post-action') return
    if (reason !== 'post-action' && hasUnsavedDraftsRef.current) {
      setRefreshNotice('Save or finish your pending user edits before refreshing.')
      return
    }
    setIsRefreshing(true)
    setError('')
    try {
      if (fresh) apiClient.clearGetRequestCache()
      const response = await apiClient.request<{ requests: RequestItem[] }>('/api/admin/access-requests', { fresh })
      setUsers(response.requests)
      setRoleDrafts(Object.fromEntries(response.requests.map((item) => [item.id, item.role || 'VIEWER'])))
      setIdentityDrafts(Object.fromEntries(response.requests.map((item) => [item.id, { name: item.name, email: item.email }])))
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

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault()
    const name = newUser.name.trim()
    const email = newUser.email.trim().toLowerCase()
    setError('')
    setMessage('')
    if (!name) return setError('User name is required.')
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid user email address.')

    setBusyId('create-user')
    try {
      const response = await apiClient.request<{ setupLink: string; message: string }>('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ name, email, role: newUser.role }),
      })
      setSetupLink(response.setupLink)
      setNewUser({ name: '', email: '', role: 'VIEWER' })
      try {
        await copyText(response.setupLink)
        setMessage('User created. One-time setup link copied.')
      } catch {
        setMessage('User created. Copy the one-time setup link manually from the panel below.')
      }
      await load('post-action', true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the user.')
    } finally {
      setBusyId('')
    }
  }

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

  const updateUser = async (id: string, payload: { name?: string; email?: string; role?: Role; status?: Extract<Status, 'ACTIVE' | 'DISABLED'> }, successMessage = 'User updated successfully.') => {
    setBusyId(id)
    setError('')
    setMessage('')
    try {
      await apiClient.request('/api/admin/users/' + id, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      setMessage(successMessage)
      await load('post-action', true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'User update failed')
    } finally {
      setBusyId('')
    }
  }

  const saveIdentity = async (item: RequestItem) => {
    const draft = identityDrafts[item.id] || { name: item.name, email: item.email }
    const name = draft.name.trim()
    const email = draft.email.trim().toLowerCase()
    setError('')
    if (!name) return setError('User name is required.')
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid user email address.')
    if (!window.confirm(`Confirm name and email update for ${item.name}?`)) return
    await updateUser(item.id, { name, email }, 'User name and email updated.')
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
      <PageHeader eyebrow="Administration" title="Access Management" description="Create user accounts, assign roles, and manage active access." actions={<StatusBadge tone="info">Admin only</StatusBadge>} />
      <div className="editor-scroll admin-access-scroll">
        <div className="admin-summary-grid">
          <SummaryCard title="Pending Requests" count={grouped.pending.length} icon={<UserRoundCog size={16} />} />
          <SummaryCard title="Needs Password" count={grouped.approved.length} icon={<Link2 size={16} />} />
          <SummaryCard title="Active Users" count={grouped.active.length} icon={<UserCheck size={16} />} />
          <SummaryCard title="Disabled / Rejected" count={grouped.disabled.length} icon={<UserMinus size={16} />} />
        </div>

        <form className="admin-create-user-panel" onSubmit={(event) => void createUser(event)} noValidate>
          <div className="admin-create-user-heading">
            <span><UserPlus size={18} /></span>
            <div>
              <h2>Create a new user</h2>
              <p>The user will receive no temporary password. Share the generated one-time setup link securely so they can choose their own password.</p>
            </div>
          </div>
          <div className="admin-create-user-grid">
            <label className="field">
              <span>User name <b aria-hidden="true">*</b></span>
              <input value={newUser.name} onChange={(event) => setNewUser((current) => ({ ...current, name: event.target.value }))} autoComplete="off" required disabled={busyId === 'create-user'} />
            </label>
            <label className="field">
              <span>Email address <b aria-hidden="true">*</b></span>
              <input type="email" value={newUser.email} onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))} autoComplete="off" required disabled={busyId === 'create-user'} />
            </label>
            <label className="field">
              <span>Role <b aria-hidden="true">*</b></span>
              <select value={newUser.role} onChange={(event) => setNewUser((current) => ({ ...current, role: event.target.value as Role }))} disabled={busyId === 'create-user'}>
                {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <button className="button admin-create-user-button" type="submit" disabled={!!busyId || !newUser.name.trim() || !newUser.email.trim()}>
              <Plus size={15} />
              {busyId === 'create-user' ? 'Creating…' : 'Create user & setup link'}
            </button>
          </div>
        </form>

        <div className="backup-actions">
          <button className="button secondary" onClick={() => void load('manual-refresh', true)} disabled={isRefreshing || !!busyId}>
            <RefreshCw size={14} />
            {isRefreshing ? 'Refreshing…' : 'Refresh users'}
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
              identityDraft={identityDrafts[item.id] || { name: item.name, email: item.email }}
              setIdentityDraft={(identity) => setIdentityDrafts((current) => ({ ...current, [item.id]: identity }))}
              onSaveIdentity={() => void saveIdentity(item)}
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
              identityDraft={identityDrafts[item.id] || { name: item.name, email: item.email }}
              setIdentityDraft={(identity) => setIdentityDrafts((current) => ({ ...current, [item.id]: identity }))}
              onSaveIdentity={() => void saveIdentity(item)}
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
              identityDraft={identityDrafts[item.id] || { name: item.name, email: item.email }}
              setIdentityDraft={(identity) => setIdentityDrafts((current) => ({ ...current, [item.id]: identity }))}
              onSaveIdentity={() => void saveIdentity(item)}
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
              identityDraft={identityDrafts[item.id] || { name: item.name, email: item.email }}
              setIdentityDraft={(identity) => setIdentityDrafts((current) => ({ ...current, [item.id]: identity }))}
              onSaveIdentity={() => void saveIdentity(item)}
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
  identityDraft,
  setIdentityDraft,
  onSaveIdentity,
  busy,
  actions,
}: {
  item: RequestItem
  roleDraft: Role
  setRoleDraft: (role: Role) => void
  identityDraft: { name: string; email: string }
  setIdentityDraft: (identity: { name: string; email: string }) => void
  onSaveIdentity: () => void
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
      <div className="admin-identity-grid">
        <label className="field"><span>User name</span><input value={identityDraft.name} onChange={(event) => setIdentityDraft({ ...identityDraft, name: event.target.value })} disabled={busy} /></label>
        <label className="field"><span>Email address</span><input type="email" value={identityDraft.email} onChange={(event) => setIdentityDraft({ ...identityDraft, email: event.target.value })} disabled={busy} /></label>
        <button className="button secondary" type="button" onClick={onSaveIdentity} disabled={busy || (identityDraft.name === item.name && identityDraft.email === item.email)}>Save identity</button>
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
