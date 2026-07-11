import { aiActionSchema, aiDomainSchema, aiStructuredActionSchema, type AiStructuredAction } from '../types.js'
import { compactReferenceForAi, type AiReferenceData } from '../reference.js'

export const allowedActions = aiActionSchema.options
export const allowedDomains = aiDomainSchema.options

export const emptyTarget = {
  crewDirectorName: null,
  crewOperationsManagerName: null,
  crewManagerName: null,
  assistantName: null,
  vesselName: null,
}

export const emptyData = {
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
}

export function unsupportedAction(summary = 'I can help only with approved Vessel Master and Organization Chart updates in this version.'): AiStructuredAction {
  return {
    domain: 'unsupported',
    action: 'unsupported',
    confidence: 1,
    reasoningSummary: summary,
    target: { ...emptyTarget },
    data: { ...emptyData },
    clarifyingQuestion: null,
    summary,
    warnings: [],
  }
}

export function stripJsonFence(value: string) {
  return value.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
}

function readObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function nullableString(value: unknown) {
  return typeof value === 'string' ? value.trim() || null : null
}

export function parseAiStructuredPayload(value: unknown): AiStructuredAction {
  const root = readObject(value)
  const rawDomain = nullableString(root.domain)?.toLowerCase()
  const rawAction = nullableString(root.action)?.toLowerCase()
  const target = readObject(root.target)
  const data = readObject(root.data)
  const normalized = {
    domain: allowedDomains.includes(rawDomain as never) ? rawDomain : 'unsupported',
    action: allowedActions.includes(rawAction as never) ? rawAction : 'unsupported',
    confidence: typeof root.confidence === 'number' ? root.confidence : 0,
    reasoningSummary: nullableString(root.reasoningSummary) || nullableString(root.summary) || 'AI interpreted the request.',
    target: {
      crewDirectorName: nullableString(target.crewDirectorName),
      crewOperationsManagerName: nullableString(target.crewOperationsManagerName || target.crewOperationManagerName),
      crewManagerName: nullableString(target.crewManagerName),
      assistantName: nullableString(target.assistantName),
      vesselName: nullableString(target.vesselName),
    },
    data: {
      name: nullableString(data.name),
      newName: nullableString(data.newName),
      vesselName: nullableString(data.vesselName),
      newVesselName: nullableString(data.newVesselName),
      vesselType: nullableString(data.vesselType),
      assignmentCrewManagerName: nullableString(data.assignmentCrewManagerName || data.crewManagerName),
      parentCrewDirectorName: nullableString(data.parentCrewDirectorName),
      parentCrewOperationsManagerName: nullableString(data.parentCrewOperationsManagerName || data.parentCrewOperationManagerName),
      parentCrewManagerName: nullableString(data.parentCrewManagerName),
      newParentCrewDirectorName: nullableString(data.newParentCrewDirectorName),
      newParentCrewOperationsManagerName: nullableString(data.newParentCrewOperationsManagerName || data.newParentCrewOperationManagerName),
      newParentCrewManagerName: nullableString(data.newParentCrewManagerName),
    },
    clarifyingQuestion: nullableString(root.clarifyingQuestion),
    summary: nullableString(root.summary) || 'AI interpreted this as an unsupported request.',
    warnings: Array.isArray(root.warnings) ? root.warnings.filter((item): item is string => typeof item === 'string') : [],
  }
  const parsed = aiStructuredActionSchema.safeParse(normalized)
  return parsed.success ? parsed.data : unsupportedAction('AI returned an invalid response shape. Please try a clearer instruction.')
}

export function aiInstructionPrompt(reference: AiReferenceData) {
  const compactReference = compactReferenceForAi(reference)
  return [
    'You are an AI assistant for a Crew Operations Organization Chart app.',
    'Convert the user instruction into exactly one strict JSON object matching the provided schema.',
    'Understand casual business English and maritime operations language.',
    'Do not write database records. Backend confirmation will do that later.',
    'Only use approved Vessel Master and Organization Chart actions.',
    'If the instruction asks for users, roles, passwords, SQL, config, security, access management, bulk delete, or Maritime Infinity, return unsupported.',
    'Resolve wording naturally: "give vessel to" means vessel assignment, "handle vessel" means assignment, "ops manager" means Crew Operations Manager, and "below/under" means parent or assignment based on entity type.',
    'If "manager" is ambiguous, ask a clarifying question instead of guessing.',
    'If a new vessel is missing vessel type or assignment, ask a clarifying question.',
    'If confidence is below 0.65, provide a clarifyingQuestion.',
    `Allowed domains: ${allowedDomains.join(', ')}.`,
    `Allowed actions: ${allowedActions.join(', ')}.`,
    'Return JSON only. No markdown.',
    '',
    'Schema:',
    JSON.stringify(aiJsonShape(), null, 2),
    '',
    'Reference data:',
    JSON.stringify(compactReference),
  ].join('\n')
}

export function aiJsonShape() {
  return {
    domain: 'vessel_master | organization_chart | unsupported',
    action: allowedActions.join(' | '),
    confidence: 'number from 0 to 1',
    reasoningSummary: 'short explanation of how the instruction was interpreted',
    target: {
      crewDirectorName: 'string or null',
      crewOperationsManagerName: 'string or null',
      crewManagerName: 'string or null',
      assistantName: 'string or null',
      vesselName: 'string or null',
    },
    data: {
      name: 'string or null',
      newName: 'string or null',
      vesselName: 'string or null',
      newVesselName: 'string or null',
      vesselType: 'string or null',
      assignmentCrewManagerName: 'string or null',
      parentCrewDirectorName: 'string or null',
      parentCrewOperationsManagerName: 'string or null',
      parentCrewManagerName: 'string or null',
      newParentCrewDirectorName: 'string or null',
      newParentCrewOperationsManagerName: 'string or null',
      newParentCrewManagerName: 'string or null',
    },
    clarifyingQuestion: 'string or null',
    summary: 'short human summary',
    warnings: ['string'],
  }
}
