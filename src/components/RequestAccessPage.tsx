import { useState } from 'react'
import { apiClient } from '../api/client'

export function RequestAccessPage({ onBack }: { onBack: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', department: '', message: '' })
  const [done, setDone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await apiClient.request<{ message: string }>('/api/access-requests', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      setDone(response.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return <div className="login-page"><form className="login-card" onSubmit={submit}><h1>Request access</h1><p>Submit an internal access request for admin review.</p><label className="field"><span>Name</span><input value={form.name} onChange={e=>setForm({ ...form, name: e.target.value })} /></label><label className="field"><span>Email</span><input type="email" value={form.email} onChange={e=>setForm({ ...form, email: e.target.value })} /></label><label className="field"><span>Department</span><input value={form.department} onChange={e=>setForm({ ...form, department: e.target.value })} /></label><label className="field"><span>Message</span><textarea rows={4} value={form.message} onChange={e=>setForm({ ...form, message: e.target.value })} /></label>{done && <p className="form-success">{done}</p>}{error && <p className="form-error">{error}</p>}<button className="button" disabled={loading}>{loading ? 'Submitting…' : 'Submit request'}</button><button type="button" className="button secondary" onClick={onBack}>Back to login</button></form></div>
}
