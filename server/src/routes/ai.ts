import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireCurrentUser } from '../auth/context.js'
import { forbidden, badRequest, notFound } from '../utils/http.js'
import { requestIp } from '../services/audit.js'
import { env } from '../config/env.js'
import { aiProviderStatus, categorizeProviderError, interpretAiPrompt, isAiProviderConfigured, notConfiguredMessage, recordAiProviderError } from '../ai/provider.js'
import { getAiReferenceData, referenceHash } from '../ai/reference.js'
import { buildAiPreview, applyAiPreview } from '../ai/actions.js'
import { deleteAiPreview, getAiPreview, storeAiPreview } from '../ai/previewStore.js'
import { scopeMismatchMessage } from '../ai/localParser.js'

const previewRequestSchema = z.object({
  prompt: z.string().transform((value) => value.trim()).pipe(z.string().min(1, 'Instruction is required.')),
  scope: z.enum(['auto', 'vessel_master', 'organization_chart']).optional(),
})

const confirmRequestSchema = z.object({
  previewId: z.string().min(1),
})

async function requireAiWriteUser(request: Parameters<typeof requireCurrentUser>[0], reply: Parameters<typeof requireCurrentUser>[1]) {
  const user = await requireCurrentUser(request, reply)
  if (!user) return null
  if (user.role !== 'ADMIN' && user.role !== 'EDITOR') {
    forbidden(reply)
    return null
  }
  return user
}

function publicPreview(stored: ReturnType<typeof storeAiPreview>) {
  return {
    previewId: stored.previewId,
    status: stored.status,
    domain: stored.domain,
    action: stored.action,
    summary: stored.summary,
    confidence: stored.confidence,
    reasoningSummary: stored.reasoningSummary,
    providerUsed: stored.providerUsed,
    fallbackUsed: stored.fallbackUsed,
    fallbackReason: stored.fallbackReason,
    changes: stored.changes,
    warnings: stored.warnings,
    clarifyingQuestion: stored.clarifyingQuestion,
    requiresConfirmation: stored.requiresConfirmation,
    errorCategory: null,
  }
}

function previewMeta(providerUsed = env.AI_PROVIDER, fallbackUsed = false, fallbackReason: string | null = null) {
  return { providerUsed, fallbackUsed, fallbackReason }
}

export async function aiRoutes(app: FastifyInstance) {
  app.get('/api/ai/status', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (request, reply) => {
    const user = await requireAiWriteUser(request, reply)
    if (!user) return
    return reply.send(aiProviderStatus())
  })

  app.post('/api/ai/preview', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const user = await requireAiWriteUser(request, reply)
    if (!user) return
    const parsed = previewRequestSchema.safeParse(request.body)
    if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message || 'Invalid AI prompt.', parsed.error.flatten())

    try {
      const reference = await getAiReferenceData()
      if (env.AI_PROVIDER === 'none' || !isAiProviderConfigured()) {
        const summary = notConfiguredMessage()
        recordAiProviderError('missing_key', summary)
        return reply.send({
          previewId: null,
          status: 'not_configured',
          domain: 'unsupported',
          action: 'unsupported',
          summary,
          confidence: 0,
          reasoningSummary: summary,
          ...previewMeta(),
          changes: [],
          warnings: env.AI_PROVIDER === 'none' ? ['Use AI_PROVIDER=mock for local deterministic testing.'] : [],
          clarifyingQuestion: null,
          requiresConfirmation: false,
          errorCategory: 'missing_key',
        })
      }

      const interpreted = await interpretAiPrompt(parsed.data.prompt, reference)
      if (!interpreted) {
        const summary = notConfiguredMessage()
        return reply.send({
          previewId: null,
          status: 'not_configured',
          domain: 'unsupported',
          action: 'unsupported',
          summary,
          confidence: 0,
          reasoningSummary: summary,
          ...previewMeta(),
          changes: [],
          warnings: [],
          clarifyingQuestion: null,
          requiresConfirmation: false,
          errorCategory: 'missing_key',
        })
      }
      const interpretedDomain = interpreted.action.domain === 'unsupported' ? null : interpreted.action.domain
      const mismatch = scopeMismatchMessage(parsed.data.scope, interpretedDomain)
      if (env.NODE_ENV === 'development') {
        request.log.info({
          aiProvider: env.AI_PROVIDER,
          aiModel: aiProviderStatus().model,
          selectedScope: parsed.data.scope || 'auto',
          interpretedDomain,
          providerUsed: interpreted.providerUsed,
          fallbackUsed: interpreted.fallbackUsed,
          llmFirst: env.AI_PROVIDER !== 'mock',
        }, 'AI preview diagnostics')
      }
      if (mismatch) {
        return reply.send({
          previewId: null,
          status: 'needs_clarification',
          domain: interpretedDomain || 'unsupported',
          action: 'unsupported',
          summary: mismatch,
          confidence: 0,
          reasoningSummary: mismatch,
          ...previewMeta(interpreted.providerUsed, interpreted.fallbackUsed, interpreted.fallbackReason),
          changes: [],
          warnings: [],
          clarifyingQuestion: mismatch,
          requiresConfirmation: false,
          errorCategory: null,
        })
      }
      const preview = {
        ...buildAiPreview(interpreted.action, reference),
        ...previewMeta(interpreted.providerUsed, interpreted.fallbackUsed, interpreted.fallbackReason),
        errorCategory: null,
      }
      if (env.NODE_ENV === 'development' && preview.status !== 'ready') {
        request.log.info({ validationStatus: preview.status, validationSummary: preview.summary }, 'AI preview validation result')
      }
      if (preview.status !== 'ready') return reply.send({ previewId: null, ...preview })
      const stored = storeAiPreview({
        ...preview,
        userId: user.id,
        prompt: parsed.data.prompt,
        structuredAction: interpreted.action,
        referenceHash: referenceHash(reference),
      })
      return reply.send(publicPreview(stored))
    } catch (error) {
      request.log.error({ error }, 'AI preview failed')
      const providerError = categorizeProviderError(error)
      const message = providerError.message
      const summary = message.includes('AI provider') || message.includes('OpenAI') || message.includes('Claude') || message.includes('Gemini') || message.includes('configured')
        ? message
        : 'AI provider request failed. Please check provider configuration or try a clearer instruction.'
      return reply.send({
        previewId: null,
        status: 'error',
        domain: 'unsupported',
        action: 'unsupported',
        summary,
        confidence: 0,
        reasoningSummary: summary,
        ...previewMeta(),
        changes: [],
        warnings: ['If this is a common Vessel Master or Organization Chart command, try a clearer instruction such as: Create one new bulk carrier called Test and assign it to Pawan Kesari.'],
        clarifyingQuestion: null,
        requiresConfirmation: false,
        errorCategory: providerError.category,
      })
    }
  })

  app.post('/api/ai/confirm', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const user = await requireAiWriteUser(request, reply)
    if (!user) return
    const parsed = confirmRequestSchema.safeParse(request.body)
    if (!parsed.success) return badRequest(reply, 'Invalid preview confirmation request.', parsed.error.flatten())

    const preview = getAiPreview(parsed.data.previewId)
    if (!preview) return notFound(reply, 'AI preview expired or was not found.')
    if (preview.userId !== user.id) return forbidden(reply, 'This AI preview belongs to another user.')
    if (preview.status !== 'ready') return badRequest(reply, 'This AI preview is not ready to confirm.')

    const reference = await getAiReferenceData()
    if (!reference.organization) return notFound(reply, 'Organization not configured')
    const currentHash = referenceHash(reference)
    if (currentHash !== preview.referenceHash) {
      deleteAiPreview(preview.previewId)
      return reply.code(409).send({ message: 'Data changed after this preview was generated. Please generate a new preview.' })
    }

    const rebuilt = buildAiPreview(preview.structuredAction, reference)
    if (rebuilt.status !== 'ready') {
      deleteAiPreview(preview.previewId)
      return reply.code(409).send({ message: rebuilt.summary || 'This AI preview is no longer valid. Please generate a new preview.' })
    }

    try {
      const updatedEntity = await applyAiPreview(preview, reference.organization.id, user.id, requestIp(request))
      deleteAiPreview(preview.previewId)
      return reply.send({
        status: 'success',
        message: 'AI-assisted update applied.',
        updatedEntity,
      })
    } catch (error) {
      request.log.error({ error }, 'AI confirm failed')
      return reply.code(500).send({ message: 'AI-assisted update could not be applied safely.' })
    }
  })
}
