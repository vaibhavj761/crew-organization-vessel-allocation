import { env } from '../../config/env.js'
import type { AiReferenceData } from '../reference.js'
import type { AiStructuredAction } from '../types.js'
import { aiInstructionPrompt, allowedActions, allowedDomains, parseAiStructuredPlanPayload, stripJsonFence } from './shared.js'

type FetchLike = typeof fetch

export async function interpretWithGemini(prompt: string, reference: AiReferenceData, fetchImpl: FetchLike = fetch): Promise<AiStructuredAction[]> {
  if (!env.GEMINI_API_KEY) throw new Error('AI Assistant is not configured on this server. Add GEMINI_API_KEY or choose another AI_PROVIDER.')
  const apiKey = env.GEMINI_API_KEY

  const callGemini = (includeSchema: boolean) => fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildBody(prompt, reference, includeSchema)),
  })

  let response = await callGemini(true)
  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    if (response.status === 400 && errorText.toLowerCase().includes('schema')) {
      response = await callGemini(false)
      if (response.ok) return parseAiStructuredPlanPayload(JSON.parse(stripJsonFence(await geminiText(response)))).actions
    }
    throw new Error(providerErrorMessage('Gemini', response.status, errorText))
  }
  return parseAiStructuredPlanPayload(JSON.parse(stripJsonFence(await geminiText(response)))).actions
}

function buildBody(prompt: string, reference: AiReferenceData, includeSchema: boolean) {
  return {
    generationConfig: {
      ...(includeSchema ? {
        responseSchema: {
          type: 'object',
          properties: {
            planSummary: { type: 'string' },
            actions: { type: 'array', minItems: 1, maxItems: 50, items: actionResponseSchema() },
          },
          required: ['planSummary', 'actions'],
        },
      } : {}),
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
    contents: [{
      role: 'user',
      parts: [{ text: `${aiInstructionPrompt(reference)}\n\nUser instruction:\n${prompt}` }],
    }],
  }
}

function actionResponseSchema() {
  const nullableText = { type: 'string', nullable: true }
  return {
    type: 'object',
    properties: {
      domain: { type: 'string', enum: allowedDomains },
      action: { type: 'string', enum: allowedActions },
      confidence: { type: 'number' },
      reasoningSummary: { type: 'string' },
      target: {
        type: 'object',
        properties: {
          crewDirectorName: nullableText,
          crewOperationsManagerName: nullableText,
          deputyManagerName: nullableText,
          crewManagerName: nullableText,
          assistantName: nullableText,
          vesselName: nullableText,
        },
      },
      data: {
        type: 'object',
        properties: {
          name: nullableText,
          newName: nullableText,
          designation: nullableText,
          newDesignation: nullableText,
          vesselName: nullableText,
          newVesselName: nullableText,
          vesselType: nullableText,
          assignmentCrewManagerName: nullableText,
          parentCrewDirectorName: nullableText,
          parentCrewOperationsManagerName: nullableText,
          parentDeputyManagerName: nullableText,
          parentCrewManagerName: nullableText,
          newParentCrewDirectorName: nullableText,
          newParentCrewOperationsManagerName: nullableText,
          newParentDeputyManagerName: nullableText,
          newParentCrewManagerName: nullableText,
        },
      },
      clarifyingQuestion: nullableText,
      summary: { type: 'string' },
      warnings: { type: 'array', items: { type: 'string' } },
    },
    required: ['domain', 'action', 'confidence', 'target', 'data', 'summary', 'warnings'],
  }
}

async function geminiText(response: Response) {
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned an empty response.')
  return text
}

function providerErrorMessage(provider: string, status: number, errorText: string) {
  const lower = errorText.toLowerCase()
  if (status === 401 || lower.includes('api_key') || lower.includes('key')) return `${provider} API key was rejected.`
  if (status === 429) return `${provider} rate limit was reached. Please try again later.`
  if (status === 404 || lower.includes('model') && (lower.includes('not found') || lower.includes('does not exist') || lower.includes('unsupported'))) return `${provider} model is unavailable or was not found.`
  return `${provider} provider request failed.`
}
