import { useEffect, useState } from 'react'
import { apiClient } from '../api/client'

type RequestItem = {
  id: string
  name: string
  email: string
  department?: string | null
  accessRequestMessage?: string | null
  role: 'ADMIN' | 'EDITOR' | 'VIEWER' | 'BOSS_VIEWER'
  status: 'PENDING_APPROVAL' | 'APPROVED_NEEDS_PASSWORD' | 'ACTIVE' | 'REJECTED' | 'DISABLED'
  createdAt: string
}

export function AdminAccessRequests() {
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [setupLink, setSetupLink] = useState('')

  const load = async () => {
    const response = await apiClient.request<{ requests: RequestItem[] }>('/api/admin/access-requests')
    setRequests(response.requests)
  }

  useEffect(() => {
    void load()
  }, [])

  const approve = async (id: string, role: RequestItem['role']) => {
    const response = await apiClient.request<{ setupLink: string }>('/api/admin/access-requests/' + id + '/approve', {
      method: 'POST',
      body: JSON.stringify({ role }),
    })
    setSetupLink(response.setupLink)
    await load()
  }

  const reject = async (id: string) => {
    await apiClient.request('/api/admin/access-requests/' + id + '/reject', { method: 'POST' })
    await load()
  }

  return <section className="editor-panel"><div className="editor-title"><span>Access requests</span><small>ADMIN only</small></div><div className="editor-scroll">{setupLink && <p className="helper-copy">Manual setup link: {setupLink}</p>}{requests.map((item) => <div className="team-editor" key={item.id}><div className="team-editor-body"><strong>{item.name}</strong><p className="helper-copy">{item.email}{item.department ? ` · ${item.department}` : ''}</p><p className="helper-copy">{item.accessRequestMessage || 'No message provided.'}</p><div className="backup-actions"><button className="button secondary" onClick={() => approve(item.id, item.role || 'VIEWER')}>Approve</button><button className="button ghost danger-text" onClick={() => reject(item.id)}>Reject</button></div></div></div>)}</div></section>
}
