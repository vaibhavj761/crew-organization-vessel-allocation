import { describe, expect, it } from 'vitest'
import { buildAiPreview } from '../server/src/ai/actions'
import { detectPromptDomain, parseLocalAiInstruction, scopeMismatchMessage } from '../server/src/ai/localParser'
import { aiProviderStatus, applyBackendSanityCorrection, categorizeProviderError, parseAiStructuredPayload, runProviderBeforeFallback, selectedAiModel, unsupportedAction } from '../server/src/ai/provider'
import { deleteAiPreview, getAiPreview, storeAiPreview } from '../server/src/ai/previewStore'
import { previewLabels } from '../src/components/AiAssistantPage'
import type { AiReferenceData } from '../server/src/ai/reference'
import type { AiStructuredAction } from '../server/src/ai/types'

const now = new Date()

function action(partial: Partial<AiStructuredAction>): AiStructuredAction {
  return {
    domain: 'organization_chart',
    action: 'unsupported',
    confidence: 1,
    target: { crewDirectorName: null, crewOperationsManagerName: null, crewManagerName: null, assistantName: null, vesselName: null },
    data: {
      name: null,
      newName: null,
      vesselName: null,
      newVesselName: null,
      vesselType: null,
      assignmentCrewManagerName: null,
      parentCrewDirectorName: null,
      parentCrewOperationsManagerName: null,
      parentCrewManagerName: null,
      newParentCrewDirectorName: null,
      newParentCrewOperationsManagerName: null,
      newParentCrewManagerName: null,
    },
    clarifyingQuestion: null,
    reasoningSummary: '',
    summary: '',
    warnings: [],
    ...partial,
  }
}

const reference = {
  organization: { id: 'org-1' },
  crewDirectors: [{ id: 'director-1', person: { name: 'Amit Kumar' }, operationsManagers: [], updatedAt: now }],
  operationsManagers: [{ id: 'ops-1', crewDirectorId: 'director-1', person: { name: 'Sidharth Bajaj' }, crewManagers: [], updatedAt: now }],
  crewManagers: [
    { id: 'cm-1', operationsManagerId: 'ops-1', person: { name: 'Pavan Kesari' }, assistants: [], vesselAllocations: [], updatedAt: now },
    { id: 'cm-2', operationsManagerId: 'ops-1', person: { name: 'Jinal Kotak' }, assistants: [], vesselAllocations: [], updatedAt: now },
  ],
  assistants: [{ id: 'assistant-1', crewManagerId: 'cm-1', person: { name: 'Neha Patil' }, updatedAt: now }],
  vessels: [{ id: 'vessel-1', name: 'Oceanic', vesselType: 'Bulk Carrier', vesselAllocations: [{ crewManagerId: 'cm-1', assignedAssistantId: null }], updatedAt: now }],
} as unknown as AiReferenceData

describe('AI Assistant safety', () => {
  it('blocks unsupported security instructions', () => {
    const preview = buildAiPreview(unsupportedAction(), reference)
    expect(preview.status).toBe('blocked')
    expect(preview.requiresConfirmation).toBe(false)
  })

  it('builds a create vessel preview only when required fields are present', () => {
    const ready = buildAiPreview(action({
      domain: 'vessel_master',
      action: 'create_vessel',
      data: { ...action({}).data, vesselName: 'North Star', vesselType: 'Tanker', assignmentCrewManagerName: 'Pavan Kesari' },
    }), reference)
    expect(ready.status).toBe('ready')
    expect(ready.resolvedIds.crewManagerId).toBe('cm-1')

    const missingType = buildAiPreview(action({
      domain: 'vessel_master',
      action: 'create_vessel',
      data: { ...action({}).data, vesselName: 'North Star', assignmentCrewManagerName: 'Pavan Kesari' },
    }), reference)
    expect(missingType.status).toBe('needs_clarification')
  })

  it('blocks duplicate vessel creation', () => {
    const preview = buildAiPreview(action({
      domain: 'vessel_master',
      action: 'create_vessel',
      data: { ...action({}).data, vesselName: 'Oceanic', vesselType: 'Tanker', assignmentCrewManagerName: 'Pavan Kesari' },
    }), reference)
    expect(preview.status).toBe('blocked')
  })

  it('builds organization hierarchy previews', () => {
    const preview = buildAiPreview(action({
      domain: 'organization_chart',
      action: 'create_crew_manager',
      data: { ...action({}).data, name: 'Ramesh Sharma', parentCrewOperationsManagerName: 'Sidharth Bajaj' },
    }), reference)
    expect(preview.status).toBe('ready')
  })

  it('blocks removing parents with linked children', () => {
    const linkedReference = {
      ...reference,
      operationsManagers: [{ ...reference.operationsManagers[0], crewManagers: [{ id: 'cm-1' }] }],
    } as AiReferenceData
    const preview = buildAiPreview(action({
      domain: 'organization_chart',
      action: 'remove_crew_operations_manager',
      target: { ...action({}).target, crewOperationsManagerName: 'Sidharth Bajaj' },
    }), linkedReference)
    expect(preview.status).toBe('blocked')
  })

  it('blocks individual hierarchy removals even when a model proposes one', () => {
    const preview = buildAiPreview(action({
      domain: 'organization_chart',
      action: 'remove_assistant',
      target: { ...action({}).target, assistantName: 'Neha Patil' },
    }), reference)
    expect(preview.status).toBe('blocked')
    expect(preview.requiresConfirmation).toBe(false)
  })

  it('stores previews server-side and removes them', () => {
    const stored = storeAiPreview({
      userId: 'user-1',
      prompt: 'Add assistant Neha under Pavan',
      structuredAction: action({ action: 'create_assistant' }),
      referenceHash: 'hash-1',
      status: 'ready',
      domain: 'organization_chart',
      action: 'create_assistant',
      summary: 'Create assistant.',
      confidence: 1,
      reasoningSummary: 'Create assistant.',
      providerUsed: 'mock',
      fallbackUsed: false,
      fallbackReason: null,
      changes: [],
      warnings: [],
      clarifyingQuestion: null,
      requiresConfirmation: true,
      affectedEntityType: 'Assistant',
      affectedEntityId: null,
      resolvedIds: { crewManagerId: 'cm-1' },
    })
    expect(getAiPreview(stored.previewId)?.userId).toBe('user-1')
    deleteAiPreview(stored.previewId)
    expect(getAiPreview(stored.previewId)).toBeNull()
  })

  it('normalizes incomplete AI JSON without throwing', () => {
    const parsed = parseAiStructuredPayload({
      domain: 'ORGANIZATION_CHART',
      action: 'CREATE_CREW_MANAGER',
      data: { name: 'Pavan Kesari', parentCrewOperationManagerName: 'Sidharth Bajaj' },
      target: {},
      summary: 'Create crew manager.',
      warnings: [],
    })
    expect(parsed.action).toBe('create_crew_manager')
    expect(parsed.data.parentCrewOperationsManagerName).toBe('Sidharth Bajaj')
  })

  it('parses common vessel commands locally for mock/fallback mode', () => {
    const parsed = parseLocalAiInstruction('Add new vessel test bulk carrier to pawan kesari')
    expect(parsed?.domain).toBe('vessel_master')
    expect(parsed?.action).toBe('create_vessel')
    expect(parsed?.data.vesselName).toBe('test')
    expect(parsed?.data.vesselType).toBe('bulk carrier')
    expect(parsed?.data.assignmentCrewManagerName).toBe('pawan kesari')
  })

  it('parses layman vessel create and assignment instructions locally for deterministic fallback', () => {
    const failedPrompt = parseLocalAiInstruction('add new vessel test under crew manager jinal type bulk carrier')
    expect(failedPrompt?.domain).toBe('vessel_master')
    expect(failedPrompt?.action).toBe('create_vessel')
    expect(failedPrompt?.data.vesselName).toBe('test')
    expect(failedPrompt?.data.vesselType).toBe('bulk carrier')
    expect(failedPrompt?.data.assignmentCrewManagerName).toBe('jinal')

    const create = parseLocalAiInstruction('Create one new bulk carrier called Oceanic and give it to Pavan')
    expect(create?.action).toBe('create_vessel')
    expect(create?.data.vesselName).toBe('Oceanic')
    expect(create?.data.vesselType).toBe('bulk carrier')
    expect(create?.data.assignmentCrewManagerName).toBe('Pavan')

    const assignment = parseLocalAiInstruction('Sidharth will handle Oceanic from now')
    expect(assignment?.action).toBe('update_vessel_assignment')
    expect(assignment?.data.vesselName).toBe('Oceanic')
    expect(assignment?.data.assignmentCrewManagerName).toBe('Sidharth')

    const compactCreate = parseLocalAiInstruction('new bulk carrier oceanic give to pavan')
    expect(compactCreate?.action).toBe('create_vessel')
    expect(compactCreate?.data.vesselName).toBe('oceanic')

    const shouldGet = parseLocalAiInstruction('jinal should get test vessel')
    expect(shouldGet?.action).toBe('update_vessel_assignment')
    expect(shouldGet?.data.assignmentCrewManagerName).toBe('jinal')
  })

  it('parses layman organization instructions locally for deterministic fallback', () => {
    expect(parseLocalAiInstruction('Add one crew ops manager named Ramesh under Amit')?.action).toBe('create_crew_operations_manager')
    expect(parseLocalAiInstruction('Put Pavan below Sidharth in the crew manager section')?.action).toBe('create_crew_manager')
    expect(parseLocalAiInstruction('put pavan below sidharth')?.action).toBe('create_crew_manager')
    expect(parseLocalAiInstruction('Add assistant Neha for Pavan')?.action).toBe('create_assistant')
    expect(parseLocalAiInstruction('add neha in pavan team')?.action).toBe('create_assistant')
    expect(parseLocalAiInstruction('add one assistant under pavan called neha')?.data.name).toBe('neha')
    expect(parseLocalAiInstruction('Move Neha from Pavan team to Sidharth team')?.action).toBe('move_assistant')
    expect(parseLocalAiInstruction('make one ops manager ramesh below amit')?.action).toBe('create_crew_operations_manager')
  })

  it('builds the exact failed layman vessel prompt as create_vessel with partial crew manager resolution', () => {
    const parsed = parseLocalAiInstruction('add new vessel test under crew manager jinal type bulk carrier')
    const preview = buildAiPreview(parsed!, reference)
    expect(preview.status).toBe('ready')
    expect(preview.domain).toBe('vessel_master')
    expect(preview.action).toBe('create_vessel')
    expect(preview.resolvedIds.crewManagerId).toBe('cm-2')
  })

  it('applies backend sanity correction when provider misclassifies a clear vessel prompt', () => {
    const localAction = parseLocalAiInstruction('add new vessel test under crew manager jinal type bulk carrier')
    const wrongProviderAction = action({
      domain: 'organization_chart',
      action: 'create_crew_manager',
      data: { ...action({}).data, name: 'test', parentCrewOperationsManagerName: 'jinal' },
    })
    const corrected = applyBackendSanityCorrection('add new vessel test under crew manager jinal type bulk carrier', wrongProviderAction, localAction)
    expect(corrected?.action).toBe('create_vessel')
  })

  it('asks clarification for ambiguous under instructions', () => {
    const parsed = parseLocalAiInstruction('Add Pavan under Sidharth')
    expect(parsed?.confidence).toBeLessThan(0.65)
    const preview = buildAiPreview(parsed!, reference)
    expect(preview.status).toBe('needs_clarification')
    expect(preview.requiresConfirmation).toBe(false)
  })

  it('detects scope mismatch without needing Gemini', () => {
    const detected = detectPromptDomain('Add new vessel test bulk carrier to pawan kesari')
    expect(detected).toBe('vessel_master')
    expect(scopeMismatchMessage('organization_chart', detected)).toContain('Vessel Master')
  })

  it('returns clear crew manager resolution messages', () => {
    const preview = buildAiPreview(action({
      domain: 'vessel_master',
      action: 'create_vessel',
      data: { ...action({}).data, vesselName: 'North Star', vesselType: 'Tanker', assignmentCrewManagerName: 'Unknown Manager' },
    }), reference)
    expect(preview.status).toBe('needs_clarification')
    expect(preview.summary).toBe('I could not find Crew Manager "Unknown Manager". Please check the name or create the Crew Manager first.')
  })

  it('asks clarification for ambiguous partial crew manager names', () => {
    const ambiguousReference = {
      ...reference,
      crewManagers: [
        ...reference.crewManagers,
        { id: 'cm-3', operationsManagerId: 'ops-1', person: { name: 'Pavan Kumar' }, assistants: [], vesselAllocations: [], updatedAt: now },
      ],
    } as AiReferenceData
    const preview = buildAiPreview(action({
      domain: 'vessel_master',
      action: 'create_vessel',
      data: { ...action({}).data, vesselName: 'North Star', vesselType: 'Tanker', assignmentCrewManagerName: 'Pavan' },
    }), ambiguousReference)
    expect(preview.status).toBe('needs_clarification')
    expect(preview.summary).toContain('Multiple Crew Managers matched "Pavan"')
  })

  it('does not show duplicate unsupported preview badges', () => {
    expect(previewLabels({
      previewId: null,
      status: 'error',
      domain: 'unsupported',
      action: 'unsupported',
      summary: 'AI provider request failed.',
      confidence: 0,
      reasoningSummary: 'AI provider request failed.',
      providerUsed: 'none',
      fallbackUsed: false,
      fallbackReason: null,
      changes: [],
      warnings: [],
      clarifyingQuestion: null,
      requiresConfirmation: false,
    })).toEqual(['Error', 'Action: Unsupported'])
  })

  it('reports AI status without exposing provider keys', () => {
    const status = aiProviderStatus()
    expect(status).toHaveProperty('provider')
    expect(status).toHaveProperty('configured')
    expect(status).toHaveProperty('model')
    expect(status).toHaveProperty('understandingMode')
    expect(status).toHaveProperty('fallbackEnabled')
    expect(status).toHaveProperty('lastProviderErrorCategory')
    expect(JSON.stringify(status).toLowerCase()).not.toContain('api_key')
    expect(selectedAiModel('openai')).toBeTruthy()
    expect(selectedAiModel('claude')).toBeTruthy()
    expect(selectedAiModel('gemini')).toBeTruthy()
  })

  it('distinguishes provider rate limits from exhausted quota', () => {
    expect(categorizeProviderError(new Error('OpenAI rate limit was reached.')).category).toBe('rate_limit')
    expect(categorizeProviderError(new Error('OpenAI quota is unavailable. Check API billing.')).category).toBe('quota')
  })

  it('finishes the configured provider call before evaluating deterministic fallback', async () => {
    const order: string[] = []
    await runProviderBeforeFallback(
      async () => { order.push('provider-start'); await Promise.resolve(); order.push('provider-end'); return action({ action: 'unsupported' }) },
      () => { order.push('fallback'); return parseLocalAiInstruction('add assistant Neha under Pavan') },
    )
    expect(order).toEqual(['provider-start', 'provider-end', 'fallback'])
  })
})
