import { env } from '../../config/env.js'
import type { AiReferenceData } from '../reference.js'
import type { AiStructuredAction } from '../types.js'
import { aiInstructionPrompt, aiPlanJsonShape, parseAiStructuredPlanPayload, stripJsonFence } from './shared.js'

type FetchLike = typeof fetch

export async function interpretWithOpenAi(prompt: string, reference: AiReferenceData, fetchImpl: FetchLike = fetch): Promise<AiStructuredAction[]> {
  if (!env.OPENAI_API_KEY) throw new Error('AI Assistant is not configured on this server. Add OPENAI_API_KEY or choose another AI_PROVIDER.')
  const apiKey = env.OPENAI_API_KEY

  const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      max_completion_tokens: 12_000,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'crew_ai_action',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              planSummary: { type: 'string' },
              actions: {
                type: 'array',
                minItems: 1,
                maxItems: 50,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
              domain: { type: 'string' },
              action: { type: 'string' },
              confidence: { type: 'number' },
              reasoningSummary: { type: 'string' },
              target: {
                type: 'object', additionalProperties: false,
                properties: {
                  crewDirectorName: { type: ['string', 'null'] }, crewOperationsManagerName: { type: ['string', 'null'] },
                  deputyManagerName: { type: ['string', 'null'] },
                  crewManagerName: { type: ['string', 'null'] }, assistantName: { type: ['string', 'null'] }, vesselName: { type: ['string', 'null'] },
                },
                required: ['crewDirectorName', 'crewOperationsManagerName', 'deputyManagerName', 'crewManagerName', 'assistantName', 'vesselName'],
              },
              data: {
                type: 'object', additionalProperties: false,
                properties: {
                  name: { type: ['string', 'null'] }, newName: { type: ['string', 'null'] }, vesselName: { type: ['string', 'null'] },
                  designation: { type: ['string', 'null'] }, newDesignation: { type: ['string', 'null'] },
                  newVesselName: { type: ['string', 'null'] }, vesselType: { type: ['string', 'null'] }, assignmentCrewManagerName: { type: ['string', 'null'] },
                  parentCrewDirectorName: { type: ['string', 'null'] }, parentCrewOperationsManagerName: { type: ['string', 'null'] }, parentCrewManagerName: { type: ['string', 'null'] },
                  parentDeputyManagerName: { type: ['string', 'null'] },
                  newParentCrewDirectorName: { type: ['string', 'null'] }, newParentCrewOperationsManagerName: { type: ['string', 'null'] }, newParentCrewManagerName: { type: ['string', 'null'] },
                  newParentDeputyManagerName: { type: ['string', 'null'] },
                },
                required: ['name', 'newName', 'designation', 'newDesignation', 'vesselName', 'newVesselName', 'vesselType', 'assignmentCrewManagerName', 'parentCrewDirectorName', 'parentCrewOperationsManagerName', 'parentDeputyManagerName', 'parentCrewManagerName', 'newParentCrewDirectorName', 'newParentCrewOperationsManagerName', 'newParentDeputyManagerName', 'newParentCrewManagerName'],
              },
              clarifyingQuestion: { type: ['string', 'null'] },
              summary: { type: 'string' },
              warnings: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['domain', 'action', 'confidence', 'reasoningSummary', 'target', 'data', 'clarifyingQuestion', 'summary', 'warnings'],
                },
              },
            },
            required: ['planSummary', 'actions'],
          },
        },
      },
      messages: [
        { role: 'system', content: aiInstructionPrompt(reference) },
        { role: 'user', content: `User instruction:\n${prompt}` },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(providerErrorMessage('OpenAI', response.status, errorText))
  }
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI returned an empty response.')
  try {
    return parseAiStructuredPlanPayload(JSON.parse(stripJsonFence(content))).actions
  } catch {
    const repaired = await repairOpenAiJson(prompt, reference, content, apiKey, fetchImpl)
    return parseAiStructuredPlanPayload(repaired).actions
  }
}

async function repairOpenAiJson(prompt: string, reference: AiReferenceData, invalidContent: string, apiKey: string, fetchImpl: FetchLike) {
  const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      max_completion_tokens: 12_000,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${aiInstructionPrompt(reference)}\nReturn valid JSON only matching this shape:\n${JSON.stringify(aiPlanJsonShape())}` },
        { role: 'user', content: `Repair this invalid AI output into the required JSON object.\n\nOriginal user instruction:\n${prompt}\n\nInvalid output:\n${invalidContent}` },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error('OpenAI returned invalid JSON and the repair attempt failed.')
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI returned invalid JSON.')
  return JSON.parse(stripJsonFence(content)) as unknown
}

function providerErrorMessage(provider: string, status: number, errorText: string) {
  const lower = errorText.toLowerCase()
  if (status === 401 || lower.includes('api key') || lower.includes('invalid_api_key')) return `${provider} API key was rejected.`
  if (status === 429 && (lower.includes('insufficient_quota') || lower.includes('quota') || lower.includes('credit'))) return `${provider} quota is unavailable. Check API billing or project limits.`
  if (status === 429) return `${provider} rate limit was reached. Please wait and try again.`
  if (status === 404 || lower.includes('model') && (lower.includes('not found') || lower.includes('does not exist') || lower.includes('unsupported'))) return `${provider} model is unavailable or was not found.`
  return `${provider} provider request failed.`
}
