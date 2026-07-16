import { Bot, CheckCircle2, CircleAlert, Mic, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { aiApi } from '../api/ai'
import { ApiError } from '../api/client'
import { useChart } from '../state/ChartContext'
import type { AiPreviewResponse, AiScope, AiStatusResponse, SafeUser } from '../types'
import { canEditChart } from '../utils/permissions'
import { AiPreviewCard } from './AiPreviewCard'
import { PageHeader, SectionCard, StatusBadge } from './ui'

type SpeechRecognitionConstructor = new () => SpeechRecognition
type SpeechRecognition = EventTarget & { lang: string; interimResults: boolean; maxAlternatives: number; start: () => void; onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null; onerror: ((event: { error?: string }) => void) | null; onend: (() => void) | null }

const examples = [
  'Add vessel Test as bulk carrier and assign it to Jinal.',
  'New bulk carrier Oceanic, give it to Pavan.',
  'Sidharth will handle Oceanic from now.',
  'Add Crew Operations Manager Ramesh under Amit.',
  'Rename Crew Manager Pavan Kesari to Pawan Kesari.',
]

function userMessage(error: unknown) {
  if (error instanceof ApiError) return error.message
  return error instanceof Error ? error.message : 'AI Assistant request failed.'
}

function label(value: string) {
  return value.split('_').filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ')
}

export function previewLabels(preview: AiPreviewResponse) {
  const items = [label(preview.status)]
  if (preview.domain !== 'unsupported') items.push(label(preview.domain))
  items.push(`Action: ${preview.action === 'unsupported' ? 'Unsupported' : label(preview.action)}`)
  return items
}

export function AiAssistantPage({ user, initialScope = 'auto' }: { user: SafeUser; initialScope?: AiScope }) {
  const canUseAi = canEditChart(user)
  const { refreshWorkspaceData } = useChart()
  const [scope, setScope] = useState<AiScope>(initialScope)
  const [prompt, setPrompt] = useState('')
  const [preview, setPreview] = useState<AiPreviewResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [message, setMessage] = useState('')
  const [messageTone, setMessageTone] = useState<'success' | 'error' | 'info'>('info')
  const [status, setStatus] = useState<AiStatusResponse | null>(null)
  const [statusError, setStatusError] = useState('')
  const requestInFlightRef = useRef(false)

  useEffect(() => setScope(initialScope), [initialScope])

  const loadStatus = useCallback(async () => {
    setStatusError('')
    try { setStatus(await aiApi.getStatus()) } catch (error) { setStatusError(userMessage(error)) }
  }, [])

  useEffect(() => { if (canUseAi) void loadStatus() }, [canUseAi, loadStatus])

  const speechRecognition = useMemo(() => {
    if (typeof window === 'undefined') return null
    const candidate = (window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition
      || (window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition
    return candidate || null
  }, [])

  const generatePreview = async () => {
    if (requestInFlightRef.current) return
    const nextPrompt = prompt.trim()
    if (!nextPrompt) { setMessageTone('error'); setMessage('Please enter an instruction first.'); return }
    requestInFlightRef.current = true
    setBusy(true); setMessage(''); setPreview(null)
    try {
      const response = await aiApi.generatePreview(nextPrompt, scope)
      setPreview(response)
      setMessageTone(response.status === 'ready' ? 'success' : response.status === 'error' ? 'error' : 'info')
      setMessage(response.status === 'ready' ? 'Preview ready. Review every proposed change before confirming.' : response.summary)
    } catch (error) {
      setMessageTone('error'); setMessage(userMessage(error))
    } finally {
      requestInFlightRef.current = false; setBusy(false); void loadStatus()
    }
  }

  const confirmPreview = async () => {
    if (!preview?.previewId || requestInFlightRef.current) return
    requestInFlightRef.current = true; setBusy(true); setMessage('')
    try {
      const response = await aiApi.confirmPreview(preview.previewId)
      setMessageTone('success'); setMessage(response.message)
      setPreview(null)
      await refreshWorkspaceData('manual-refresh')
    } catch (error) {
      setMessageTone('error'); setMessage(userMessage(error))
    } finally { requestInFlightRef.current = false; setBusy(false) }
  }

  const startVoiceInput = () => {
    if (!speechRecognition) { setMessageTone('error'); setMessage('Voice input is not supported in this browser. Please type your instruction.'); return }
    setMessage('')
    const recognition = new speechRecognition()
    recognition.lang = 'en-US'; recognition.interimResults = false; recognition.maxAlternatives = 1
    recognition.onresult = (event) => { const transcript = event.results[0]?.[0]?.transcript?.trim(); if (transcript) setPrompt((current) => current ? `${current.trim()} ${transcript}` : transcript) }
    recognition.onerror = (event) => { setListening(false); setMessageTone('error'); setMessage(event.error === 'not-allowed' ? 'Microphone permission was denied. Please type your instruction.' : 'Voice input failed. Please try again or type your instruction.') }
    recognition.onend = () => setListening(false)
    setListening(true); recognition.start()
  }

  if (!canUseAi) return <div className="ai-page page-surface"><PageHeader eyebrow="Controlled automation" title="AI Assistant" description="AI-assisted updates are available only to Admin and Editor users." actions={<StatusBadge tone="warning">Read only</StatusBadge>} /></div>

  const providerHealthy = Boolean(status?.configured && !status.lastProviderErrorCategory)
  return (
    <div className="ai-page page-surface">
      <PageHeader eyebrow="Controlled automation" title="AI Assistant" description="Describe an operational update in plain language. AI will create a validated preview; you remain in control of every database change." actions={<StatusBadge tone={providerHealthy ? 'success' : status?.configured ? 'warning' : 'danger'}>{providerHealthy ? 'Provider ready' : status?.configured ? 'Provider attention' : 'Not configured'}</StatusBadge>} />

      <div className="ai-workspace-grid">
        <main className="ai-main-column">
          <SectionCard title="Create an update preview" description="Submit one update or paste a list of up to 50 Vessel Master or Organization Chart changes.">
            <div className="ai-composer">
              <label className="field"><span>Update area</span><select value={scope} onChange={(event) => setScope(event.target.value as AiScope)} disabled={busy}><option value="auto">Auto-detect from instruction</option><option value="vessel_master">Vessel Master</option><option value="organization_chart">Organization Chart</option></select></label>
              <label className="field ai-prompt"><span>Instruction</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Example: Add vessel Test as bulk carrier and assign it to Jinal." disabled={busy} /><small>Use one update per line for lists. Every item is validated and nothing is saved unless the complete preview is safe.</small></label>
              <div className="ai-actions">
                <button className="button secondary" type="button" onClick={startVoiceInput} disabled={busy || listening}><Mic size={15} />{listening ? 'Listening…' : 'Speak'}</button>
                <button className="button" type="button" onClick={() => void generatePreview()} disabled={busy || !prompt.trim()}><Sparkles size={15} />{busy ? 'Generating preview…' : 'Generate preview'}</button>
                <button className="button ghost" type="button" onClick={() => { setPrompt(''); setPreview(null); setMessage('') }} disabled={busy || (!prompt && !preview)}>Clear</button>
              </div>
            </div>
          </SectionCard>

          {message ? <div className={`ai-message ai-message--${messageTone}`} role={messageTone === 'error' ? 'alert' : 'status'}>{messageTone === 'success' ? <CheckCircle2 size={16} /> : messageTone === 'error' ? <CircleAlert size={16} /> : <Bot size={16} />}<span>{message}</span></div> : null}
          {preview ? <AiPreviewCard preview={preview} busy={busy} onConfirm={() => void confirmPreview()} onCancel={() => setPreview(null)} /> : null}
        </main>

        <aside className="ai-side-column">
          <SectionCard title="Provider status" description="Server-side configuration only." actions={<button className="icon-button" type="button" onClick={() => void loadStatus()} disabled={busy} aria-label="Refresh provider status"><RefreshCw size={15} /></button>}>
            <div className="ai-provider-status">
              <div><span className={`provider-indicator ${providerHealthy ? 'is-ready' : ''}`} /><p><strong>{status ? label(status.provider) : 'Checking provider…'}</strong><small>{status?.model || 'Model not available'}</small></p></div>
              <dl><div><dt>Mode</dt><dd>{status ? label(status.understandingMode) : 'Checking…'}</dd></div><div><dt>Fallback</dt><dd>{status ? (status.fallbackEnabled ? 'Available' : 'Disabled') : 'Checking…'}</dd></div><div><dt>Preview storage</dt><dd>Secure server memory</dd></div></dl>
              {status?.lastProviderErrorMessage ? <div className="ai-provider-error"><CircleAlert size={15} /><p><strong>{label(status.lastProviderErrorCategory || 'provider_error')}</strong><span>{status.lastProviderErrorMessage}</span></p></div> : null}
              {statusError ? <div className="ai-provider-error"><CircleAlert size={15} /><p><strong>Server unavailable</strong><span>{statusError}</span></p></div> : null}
            </div>
          </SectionCard>

          <SectionCard title="Try an example" description="Select a prompt, then adjust the names if needed.">
            <div className="ai-example-list">{examples.map((example) => <button type="button" key={example} onClick={() => setPrompt(example)} disabled={busy}>{example}</button>)}</div>
          </SectionCard>

          <div className="ai-safety-note"><ShieldCheck size={18} /><div><strong>Preview-first safety</strong><p>AI cannot change users, roles, passwords, permissions, deployment settings, or the database directly.</p></div></div>
        </aside>
      </div>
    </div>
  )
}
