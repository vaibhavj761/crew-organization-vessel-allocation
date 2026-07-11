import { Bot, CheckCircle2, Mic, Sparkles, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { aiApi } from '../api/ai'
import { ApiError } from '../api/client'
import { useChart } from '../state/ChartContext'
import type { AiPreviewResponse, AiScope, AiStatusResponse, SafeUser } from '../types'
import { canEditChart } from '../utils/permissions'

type SpeechRecognitionConstructor = new () => SpeechRecognition
type SpeechRecognition = EventTarget & {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
}

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
  const [status, setStatus] = useState<AiStatusResponse | null>(null)
  const [statusError, setStatusError] = useState('')

  useEffect(() => {
    setScope(initialScope)
  }, [initialScope])

  useEffect(() => {
    if (!canUseAi) return
    let cancelled = false
    aiApi.getStatus()
      .then((response) => {
        if (!cancelled) setStatus(response)
      })
      .catch((error) => {
        if (!cancelled) setStatusError(userMessage(error))
      })
    return () => {
      cancelled = true
    }
  }, [canUseAi])

  const speechRecognition = useMemo(() => {
    if (typeof window === 'undefined') return null
    const candidate = (window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).SpeechRecognition
      || (window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition
    return candidate || null
  }, [])

  const generatePreview = async () => {
    const nextPrompt = prompt.trim()
    if (!nextPrompt) {
      setMessage('Please enter an instruction first.')
      return
    }
    setBusy(true)
    setMessage('')
    setPreview(null)
    try {
      const response = await aiApi.generatePreview(nextPrompt, scope)
      setPreview(response)
      setMessage(response.status === 'ready' ? 'Preview generated. Review it before confirming.' : response.summary)
    } catch (error) {
      setMessage(userMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const confirmPreview = async () => {
    if (!preview?.previewId) return
    setBusy(true)
    setMessage('')
    try {
      const response = await aiApi.confirmPreview(preview.previewId)
      setMessage(response.message)
      setPreview({ ...preview, requiresConfirmation: false, summary: `${preview.summary} Applied successfully.` })
      await refreshWorkspaceData('manual-refresh')
    } catch (error) {
      setMessage(userMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const startVoiceInput = () => {
    if (!speechRecognition) {
      setMessage('Voice input is not supported in this browser. Please type your instruction.')
      return
    }
    setMessage('')
    const recognition = new speechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim()
      if (transcript) setPrompt((current) => current ? `${current.trim()} ${transcript}` : transcript)
    }
    recognition.onerror = (event) => {
      setListening(false)
      setMessage(event.error === 'not-allowed' ? 'Microphone permission was denied. Please type your instruction.' : 'Voice input failed. Please try again or type your instruction.')
    }
    recognition.onend = () => setListening(false)
    setListening(true)
    recognition.start()
  }

  if (!canUseAi) {
    return (
      <div className="ai-page">
        <div className="ai-hero">
          <Bot size={24} />
          <div>
            <h2>AI Assistant</h2>
            <p>AI updates are available only to Admin and Editor users.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="ai-page">
      <div className="ai-hero">
        <Bot size={24} />
        <div>
          <h2>AI Assistant</h2>
          <p>Tell AI what you want to update. It will understand the request and show a preview before saving.</p>
        </div>
      </div>

      <div className="ai-compose">
        <div className="ai-status-grid">
          <span><strong>Provider</strong>{status?.provider || 'Checking...'}</span>
          <span><strong>Configured</strong>{status ? (status.configured ? 'Yes' : 'No') : statusError || 'Checking...'}</span>
          <span><strong>Model</strong>{status?.model || 'Not loaded'}</span>
          <span><strong>Understanding</strong>{status?.understandingMode || 'Checking...'}</span>
          <span><strong>Fallback</strong>{status ? (status.fallbackEnabled ? 'Enabled' : 'Disabled') : 'Checking...'}</span>
          <span><strong>Preview store</strong>{status?.previewStore || 'memory'}</span>
        </div>
        {status?.lastProviderErrorMessage ? (
          <p className="ai-provider-note">
            Provider status: {label(status.lastProviderErrorCategory || 'error')} — {status.lastProviderErrorMessage}
          </p>
        ) : null}
        <div className="ai-help-panel">
          <p>AI can update only Vessel Master and Organization Chart. It cannot change users, roles, passwords, or permissions.</p>
          <div className="ai-example-list">
            <button type="button" onClick={() => setPrompt('Create a new bulk carrier called Oceanic and give it to Pavan.')} disabled={busy}>Create a new bulk carrier called Oceanic and give it to Pavan.</button>
            <button type="button" onClick={() => setPrompt('Put Pavan under Sidharth as Crew Manager.')} disabled={busy}>Put Pavan under Sidharth as Crew Manager.</button>
            <button type="button" onClick={() => setPrompt('Add assistant Neha under Pavan.')} disabled={busy}>Add assistant Neha under Pavan.</button>
            <button type="button" onClick={() => setPrompt('Sidharth will handle Oceanic from now.')} disabled={busy}>Sidharth will handle Oceanic from now.</button>
          </div>
        </div>
        <label>
          Scope
          <select value={scope} onChange={(event) => setScope(event.target.value as AiScope)}>
            <option value="auto">Auto-detect</option>
            <option value="vessel_master">Vessel Master</option>
            <option value="organization_chart">Organization Chart</option>
          </select>
        </label>
        <label className="ai-prompt">
          Instruction
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Example: Add vessel Test as bulk carrier and assign it to Jinal."
          />
        </label>
        <div className="ai-actions">
          <button className="button secondary" type="button" onClick={startVoiceInput} disabled={busy || listening}>
            <Mic size={14} />
            {listening ? 'Listening...' : 'Speak'}
          </button>
          <button className="button" type="button" onClick={() => void generatePreview()} disabled={busy}>
            <Sparkles size={14} />
            {busy ? 'Working...' : 'Generate Preview'}
          </button>
          <button className="button ghost" type="button" onClick={() => { setPrompt(''); setPreview(null); setMessage('') }} disabled={busy}>Clear</button>
        </div>
      </div>

      {message ? <p className={`ai-message ${preview?.status === 'ready' ? 'success' : ''}`}>{message}</p> : null}

      {preview ? (
        <div className="ai-preview-card">
          <div className="ai-preview-top">
            {previewLabels(preview).map((item, index) => (
              <span key={item} className={index === 0 ? `ai-status ai-status-${preview.status}` : undefined}>{item}</span>
            ))}
          </div>
          <h3>{preview.summary}</h3>
          <div className="ai-interpretation">
            <p><strong>I understood this as:</strong> {preview.reasoningSummary || preview.summary}</p>
            <span>Confidence: {Math.round((preview.confidence || 0) * 100)}%</span>
            <span>Provider: {label(preview.providerUsed)}</span>
            <span>Fallback: {preview.fallbackUsed ? 'Yes' : 'No'}</span>
          </div>
          {preview.fallbackUsed ? (
            <p className="ai-clarification">
              Real AI provider was unavailable or uncertain. This preview was generated by local fallback and may need clearer wording.
              {preview.fallbackReason ? ` Reason: ${preview.fallbackReason}` : ''}
            </p>
          ) : null}
          {preview.clarifyingQuestion ? <p className="ai-clarification">{preview.clarifyingQuestion}</p> : null}
          {preview.changes.length ? (
            <table className="ai-changes">
              <thead><tr><th>Entity</th><th>Field</th><th>Current</th><th>Proposed</th></tr></thead>
              <tbody>
                {preview.changes.map((item, index) => (
                  <tr key={`${item.entity}-${item.field}-${index}`}>
                    <td>{item.entity}</td>
                    <td>{item.field}</td>
                    <td>{item.oldValue || 'None'}</td>
                    <td>{item.newValue || 'None'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {preview.warnings.length ? <ul className="ai-warnings">{preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}
          <div className="ai-confirm-row">
            <button className="button" type="button" onClick={() => void confirmPreview()} disabled={busy || !preview.requiresConfirmation || !preview.previewId}>
              <CheckCircle2 size={14} />
              Confirm Update
            </button>
            <button className="button secondary" type="button" onClick={() => setPreview(null)} disabled={busy}>
              <XCircle size={14} />
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
