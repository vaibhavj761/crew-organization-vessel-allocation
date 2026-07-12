import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AiAssistantPage } from '../src/components/AiAssistantPage'
import { AiPreviewCard } from '../src/components/AiPreviewCard'
import type { AiPreviewResponse, SafeUser } from '../src/types'

const { generatePreviewMock, getStatusMock, confirmPreviewMock, refreshWorkspaceDataMock } = vi.hoisted(() => ({
  generatePreviewMock: vi.fn(),
  getStatusMock: vi.fn(),
  confirmPreviewMock: vi.fn(),
  refreshWorkspaceDataMock: vi.fn(),
}))

vi.mock('../src/api/ai', () => ({
  aiApi: { getStatus: getStatusMock, generatePreview: generatePreviewMock, confirmPreview: confirmPreviewMock },
}))

vi.mock('../src/state/ChartContext', () => ({
  useChart: () => ({ refreshWorkspaceData: refreshWorkspaceDataMock }),
}))

const user: SafeUser = {
  id: 'admin-1', name: 'Admin User', email: 'admin@example.com', role: 'ADMIN', status: 'ACTIVE', isActive: true,
  lastLoginAt: null, createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z',
}

const preview: AiPreviewResponse = {
  previewId: 'preview-1', status: 'ready', domain: 'vessel_master', action: 'create_vessel',
  summary: 'Create vessel Oceanic and assign it to Pavan Kesari.', confidence: .96,
  reasoningSummary: 'Create a bulk carrier and allocate it to the resolved Crew Manager.',
  providerUsed: 'openai', fallbackUsed: false, fallbackReason: null,
  changes: [{ entity: 'Vessel', field: 'Name', oldValue: null, newValue: 'Oceanic' }], warnings: [],
  clarifyingQuestion: null, requiresConfirmation: true, errorCategory: null,
}

describe('AI Assistant interaction safety', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks() })

  it('prevents duplicate preview requests while the first request is in flight', async () => {
    getStatusMock.mockResolvedValue({ provider: 'openai', configured: true, model: 'configured-model', understandingMode: 'llm-first', fallbackEnabled: true, lastProviderErrorCategory: null, lastProviderErrorMessage: null, voiceInput: 'browser-only', previewStore: 'memory' })
    generatePreviewMock.mockImplementation(() => new Promise(() => undefined))
    render(<AiAssistantPage user={user} />)

    fireEvent.click(screen.getByRole('button', { name: /Add vessel Test/i }))
    const button = screen.getByRole('button', { name: /Generate preview/i })
    fireEvent.click(button)
    fireEvent.click(button)

    await waitFor(() => expect(generatePreviewMock).toHaveBeenCalledTimes(1))
  })

  it('renders provider, confidence, proposed changes, and confirmation controls', () => {
    render(<AiPreviewCard preview={preview} busy={false} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Openai')).toBeInTheDocument()
    expect(screen.getByText('96%')).toBeInTheDocument()
    expect(screen.getByText('Proposed changes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Confirm update/i })).toBeEnabled()
  })

  it('disables confirmation for provider errors and shows the safe category', () => {
    render(<AiPreviewCard preview={{ ...preview, previewId: null, status: 'error', domain: 'unsupported', action: 'unsupported', requiresConfirmation: false, errorCategory: 'rate_limit', summary: 'Please wait and try again.' }} busy={false} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Rate Limit')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Confirm update/i })).toBeDisabled()
  })
})
