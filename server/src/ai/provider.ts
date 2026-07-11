import { env } from '../config/env.js'
import type { AiReferenceData } from './reference.js'
import type { AiStructuredAction } from './types.js'
import { parseLocalAiInstruction } from './localParser.js'
import { interpretWithClaude } from './providers/claude.js'
import { interpretWithGemini } from './providers/gemini.js'
import { interpretWithMock } from './providers/mock.js'
import { interpretWithOpenAi } from './providers/openai.js'
import { parseAiStructuredPayload, unsupportedAction } from './providers/shared.js'

export { parseAiStructuredPayload, unsupportedAction }

export type AiProviderName = typeof env.AI_PROVIDER

export type AiProviderStatus = {
  provider: AiProviderName
  configured: boolean
  model: string
  understandingMode: 'llm-first' | 'local-parser' | 'disabled'
  fallbackEnabled: boolean
  lastProviderErrorCategory: AiProviderErrorCategory | null
  lastProviderErrorMessage: string | null
  voiceInput: 'browser-only'
  previewStore: 'memory'
}

export type AiProviderErrorCategory = 'missing_key' | 'invalid_key' | 'model_not_found' | 'quota' | 'network' | 'invalid_response'

let lastProviderError: { category: AiProviderErrorCategory; message: string } | null = null

export type AiInterpretResult = {
  action: AiStructuredAction
  providerUsed: AiProviderName
  fallbackUsed: boolean
  fallbackReason: string | null
}

export function selectedAiModel(provider: AiProviderName = env.AI_PROVIDER) {
  if (provider === 'openai') return env.OPENAI_MODEL
  if (provider === 'claude') return env.CLAUDE_MODEL
  if (provider === 'gemini') return env.GEMINI_MODEL
  if (provider === 'mock') return 'local-parser'
  return 'none'
}

export function isAiProviderConfigured(provider: AiProviderName = env.AI_PROVIDER) {
  if (provider === 'openai') return Boolean(env.OPENAI_API_KEY)
  if (provider === 'claude') return Boolean(env.ANTHROPIC_API_KEY)
  if (provider === 'gemini') return Boolean(env.GEMINI_API_KEY)
  if (provider === 'mock') return true
  return false
}

export function aiProviderStatus(): AiProviderStatus {
  const configured = isAiProviderConfigured()
  const missingKeyError = !configured && env.AI_PROVIDER !== 'mock' && env.AI_PROVIDER !== 'none'
    ? { category: 'missing_key' as const, message: notConfiguredMessage() }
    : null
  const currentError = lastProviderError || missingKeyError
  return {
    provider: env.AI_PROVIDER,
    configured,
    model: selectedAiModel(),
    understandingMode: env.AI_PROVIDER === 'none' ? 'disabled' : env.AI_PROVIDER === 'mock' ? 'local-parser' : 'llm-first',
    fallbackEnabled: env.AI_PROVIDER !== 'mock' && env.AI_PROVIDER !== 'none',
    lastProviderErrorCategory: currentError?.category || null,
    lastProviderErrorMessage: currentError?.message || null,
    voiceInput: 'browser-only',
    previewStore: 'memory',
  }
}

export function notConfiguredMessage(provider: AiProviderName = env.AI_PROVIDER) {
  if (provider === 'openai') return 'AI Assistant is not configured on this server. Add OPENAI_API_KEY or choose another AI_PROVIDER.'
  if (provider === 'claude') return 'AI Assistant is not configured on this server. Add ANTHROPIC_API_KEY or choose another AI_PROVIDER.'
  if (provider === 'gemini') return 'AI Assistant is not configured on this server. Add GEMINI_API_KEY or choose another AI_PROVIDER.'
  if (provider === 'none') return 'AI Assistant is not configured on this server. Set AI_PROVIDER to openai, claude, gemini, or mock.'
  return 'AI Assistant is not configured on this server.'
}

export function canUseLocalFallback(errorOrAction: unknown, localAction: AiStructuredAction | null) {
  if (!localAction || localAction.action === 'unsupported') return false
  if (errorOrAction instanceof Error) return true
  const action = errorOrAction as Partial<AiStructuredAction> | null
  return action?.action === 'unsupported' || action?.domain === 'unsupported'
}

export function recordAiProviderError(category: AiProviderErrorCategory, message: string) {
  lastProviderError = { category, message }
}

export function clearAiProviderError() {
  lastProviderError = null
}

export function categorizeProviderError(error: unknown): { category: AiProviderErrorCategory; message: string } {
  const message = error instanceof Error && error.message ? error.message : 'AI provider request failed.'
  const lower = message.toLowerCase()
  if (lower.includes('not configured') || lower.includes('add ') && lower.includes('api_key')) return { category: 'missing_key', message }
  if (lower.includes('key was rejected') || lower.includes('invalid key') || lower.includes('unauthorized')) return { category: 'invalid_key', message }
  if (lower.includes('model') && (lower.includes('not found') || lower.includes('unavailable') || lower.includes('unsupported'))) return { category: 'model_not_found', message }
  if (lower.includes('quota') || lower.includes('rate limit')) return { category: 'quota', message }
  if (lower.includes('invalid json') || lower.includes('invalid response') || lower.includes('empty response')) return { category: 'invalid_response', message }
  if (lower.includes('fetch failed') || lower.includes('network') || lower.includes('econn') || lower.includes('timeout')) return { category: 'network', message: 'AI provider network request failed.' }
  return { category: 'invalid_response', message }
}

export async function interpretAiPrompt(prompt: string, reference: AiReferenceData): Promise<AiInterpretResult | null> {
  if (env.AI_PROVIDER === 'mock') {
    const action = await interpretWithMock(prompt, reference)
    return { action, providerUsed: 'mock', fallbackUsed: false, fallbackReason: null }
  }
  if (env.AI_PROVIDER === 'none') return null
  if (!isAiProviderConfigured()) return null

  try {
    const aiAction = await interpretWithSelectedProvider(prompt, reference)
    clearAiProviderError()
    const localFallback = parseLocalAiInstruction(prompt)
    const corrected = applyBackendSanityCorrection(prompt, aiAction, localFallback)
    if (corrected) return {
      action: {
        ...corrected,
        warnings: [...corrected.warnings, 'Backend sanity correction was applied because the prompt clearly described a different approved action.'],
      },
      providerUsed: env.AI_PROVIDER,
      fallbackUsed: true,
      fallbackReason: 'Provider interpretation conflicted with clear app-context intent.',
    }
    if (canUseLocalFallback(aiAction, localFallback)) return {
      action: {
        ...localFallback!,
        warnings: [...localFallback!.warnings, 'AI provider could not confidently interpret this; a deterministic local command fallback was used.'],
      },
      providerUsed: env.AI_PROVIDER,
      fallbackUsed: true,
      fallbackReason: 'Provider returned unsupported for an obvious deterministic command.',
    }
    return { action: aiAction, providerUsed: env.AI_PROVIDER, fallbackUsed: false, fallbackReason: null }
  } catch (error) {
    const providerError = categorizeProviderError(error)
    recordAiProviderError(providerError.category, providerError.message)
    const localFallback = parseLocalAiInstruction(prompt)
    if (canUseLocalFallback(error, localFallback)) return {
      action: {
        ...localFallback!,
        warnings: [...localFallback!.warnings, 'Real AI provider was unavailable. This preview was generated by local fallback and may need clearer wording.'],
      },
      providerUsed: env.AI_PROVIDER,
      fallbackUsed: true,
      fallbackReason: providerError.message,
    }
    throw error
  }
}

export function applyBackendSanityCorrection(prompt: string, aiAction: AiStructuredAction, localAction: AiStructuredAction | null) {
  if (!localAction || localAction.action === 'unsupported') return null
  const lower = prompt.toLowerCase()
  const hasVesselSignal = /\b(vessel|ship|bulk carrier|tanker|container|lng|lpg|assign|handle|give|get)\b/.test(lower)
  const hasAssistantSignal = /\b(assistant|team member|in .+ team|from .+ team to .+ team)\b/.test(lower)
  const explicitCrewManager = /\bcrew manager\b/.test(lower) && !/\bvessel\b/.test(lower)
  if (hasVesselSignal && aiAction.domain !== 'vessel_master' && localAction.domain === 'vessel_master') return localAction
  if (hasVesselSignal && aiAction.action === 'create_crew_manager' && localAction.domain === 'vessel_master') return localAction
  if (hasAssistantSignal && aiAction.domain !== 'organization_chart' && localAction.domain === 'organization_chart') return localAction
  if (!explicitCrewManager && hasVesselSignal && localAction.action.startsWith('update_vessel')) return localAction
  return null
}

async function interpretWithSelectedProvider(prompt: string, reference: AiReferenceData) {
  if (env.AI_PROVIDER === 'openai') return interpretWithOpenAi(prompt, reference)
  if (env.AI_PROVIDER === 'claude') return interpretWithClaude(prompt, reference)
  if (env.AI_PROVIDER === 'gemini') return interpretWithGemini(prompt, reference)
  return unsupportedAction()
}
