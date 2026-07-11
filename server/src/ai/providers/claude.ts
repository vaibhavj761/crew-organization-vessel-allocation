import { env } from '../../config/env.js'
import type { AiReferenceData } from '../reference.js'
import type { AiStructuredAction } from '../types.js'
import { aiInstructionPrompt, aiJsonShape, parseAiStructuredPayload, stripJsonFence } from './shared.js'

type FetchLike = typeof fetch

export async function interpretWithClaude(prompt: string, reference: AiReferenceData, fetchImpl: FetchLike = fetch): Promise<AiStructuredAction> {
  if (!env.ANTHROPIC_API_KEY) throw new Error('AI Assistant is not configured on this server. Add ANTHROPIC_API_KEY or choose another AI_PROVIDER.')
  const apiKey = env.ANTHROPIC_API_KEY

  const response = await callClaude(prompt, reference, apiKey, fetchImpl)
  const content = extractClaudeText(response)
  try {
    return parseAiStructuredPayload(JSON.parse(stripJsonFence(content)))
  } catch {
    const repaired = await repairClaudeJson(prompt, reference, content, apiKey, fetchImpl)
    return parseAiStructuredPayload(repaired)
  }
}

async function callClaude(prompt: string, reference: AiReferenceData, apiKey: string, fetchImpl: FetchLike) {
  const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.CLAUDE_MODEL,
      max_tokens: 1200,
      temperature: 0.1,
      system: aiInstructionPrompt(reference),
      messages: [{ role: 'user', content: `User instruction:\n${prompt}` }],
    }),
  })
  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(providerErrorMessage('Claude', response.status, errorText))
  }
  return response.json() as Promise<{ content?: Array<{ type?: string; text?: string }> }>
}

async function repairClaudeJson(prompt: string, reference: AiReferenceData, invalidContent: string, apiKey: string, fetchImpl: FetchLike) {
  const response = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.CLAUDE_MODEL,
      max_tokens: 1200,
      temperature: 0,
      system: `${aiInstructionPrompt(reference)}\nReturn valid JSON only matching this shape:\n${JSON.stringify(aiJsonShape())}`,
      messages: [{ role: 'user', content: `Repair this invalid AI output into the required JSON object.\n\nOriginal user instruction:\n${prompt}\n\nInvalid output:\n${invalidContent}` }],
    }),
  })
  if (!response.ok) throw new Error('Claude returned invalid JSON and the repair attempt failed.')
  return JSON.parse(stripJsonFence(extractClaudeText(await response.json() as { content?: Array<{ type?: string; text?: string }> }))) as unknown
}

function extractClaudeText(payload: { content?: Array<{ type?: string; text?: string }> }) {
  const text = payload.content?.find((item) => item.type === 'text' && item.text)?.text
  if (!text) throw new Error('Claude returned an empty response.')
  return text
}

function providerErrorMessage(provider: string, status: number, errorText: string) {
  const lower = errorText.toLowerCase()
  if (status === 401 || lower.includes('api key') || lower.includes('authentication')) return `${provider} API key was rejected.`
  if (status === 429) return `${provider} rate limit was reached. Please try again later.`
  if (status === 404 || lower.includes('model') && (lower.includes('not found') || lower.includes('does not exist') || lower.includes('unsupported'))) return `${provider} model is unavailable or was not found.`
  return `${provider} provider request failed.`
}
