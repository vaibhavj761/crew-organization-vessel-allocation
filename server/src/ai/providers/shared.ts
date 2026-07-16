import { aiActionSchema, aiDomainSchema, aiStructuredActionSchema, type AiStructuredAction, type AiStructuredPlan } from '../types.js'
import { compactReferenceForAi, type AiReferenceData } from '../reference.js'

export const allowedActions = aiActionSchema.options
export const modelAllowedActions = allowedActions.filter((action) => !action.startsWith('remove_') && !action.includes('assistant'))
export const allowedDomains = aiDomainSchema.options

export const emptyTarget = {
  crewDirectorName: null,
  crewOperationsManagerName: null,
  deputyManagerName: null,
  crewManagerName: null,
  assistantName: null,
  vesselName: null,
}

export const emptyData = {
  name: null,
  newName: null,
  designation: null,
  newDesignation: null,
  vesselName: null,
  newVesselName: null,
  vesselType: null,
  assignmentCrewManagerName: null,
  parentCrewDirectorName: null,
  parentCrewOperationsManagerName: null,
  parentDeputyManagerName: null,
  parentCrewManagerName: null,
  newParentCrewDirectorName: null,
  newParentCrewOperationsManagerName: null,
  newParentDeputyManagerName: null,
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
      deputyManagerName: nullableString(target.deputyManagerName),
      crewManagerName: nullableString(target.crewManagerName),
      assistantName: nullableString(target.assistantName),
      vesselName: nullableString(target.vesselName),
    },
    data: {
      name: nullableString(data.name),
      newName: nullableString(data.newName),
      designation: nullableString(data.designation),
      newDesignation: nullableString(data.newDesignation || data.designation),
      vesselName: nullableString(data.vesselName),
      newVesselName: nullableString(data.newVesselName),
      vesselType: nullableString(data.vesselType),
      assignmentCrewManagerName: nullableString(data.assignmentCrewManagerName || data.crewManagerName),
      parentCrewDirectorName: nullableString(data.parentCrewDirectorName),
      parentCrewOperationsManagerName: nullableString(data.parentCrewOperationsManagerName || data.parentCrewOperationManagerName),
      parentDeputyManagerName: nullableString(data.parentDeputyManagerName),
      parentCrewManagerName: nullableString(data.parentCrewManagerName),
      newParentCrewDirectorName: nullableString(data.newParentCrewDirectorName),
      newParentCrewOperationsManagerName: nullableString(data.newParentCrewOperationsManagerName || data.newParentCrewOperationManagerName),
      newParentDeputyManagerName: nullableString(data.newParentDeputyManagerName),
      newParentCrewManagerName: nullableString(data.newParentCrewManagerName),
    },
    clarifyingQuestion: nullableString(root.clarifyingQuestion),
    summary: nullableString(root.summary) || 'AI interpreted this as an unsupported request.',
    warnings: Array.isArray(root.warnings) ? root.warnings.filter((item): item is string => typeof item === 'string') : [],
  }
  const parsed = aiStructuredActionSchema.safeParse(normalized)
  return parsed.success ? parsed.data : unsupportedAction('AI returned an invalid response shape. Please try a clearer instruction.')
}

export function parseAiStructuredPlanPayload(value: unknown): AiStructuredPlan {
  const root = readObject(value)
  const rawActions = Array.isArray(root.actions) ? root.actions : [value]
  if (rawActions.length > 50) return { summary: 'AI proposed more than the supported 50 updates. Split the request into smaller batches.', actions: [unsupportedAction('AI proposed more than the supported 50 updates. Split the request into smaller batches.')] }
  const actions = rawActions.map(parseAiStructuredPayload)
  if (!actions.length) return { summary: 'AI did not return any proposed actions.', actions: [unsupportedAction('AI did not return any proposed actions.')] }
  return {
    summary: nullableString(root.planSummary || root.summary) || (actions.length === 1 ? actions[0].summary : `Prepare ${actions.length} proposed updates.`),
    actions,
  }
}

export function aiInstructionPrompt(reference: AiReferenceData) {
  const compactReference = compactReferenceForAi(reference)
  return [
    'You are an AI assistant for a Crew Operations Organization Chart app.',
    'Convert the user instruction into one strict JSON plan matching the provided schema.',
    'The plan must contain one action for a single request or multiple actions when the user supplies a list. Never combine separate records into one action.',
    'Return no more than 50 actions. Preserve every supplied spelling and value unless validation requires clarification.',
    'Understand casual business English and maritime operations language.',
    'Do not write database records. Backend confirmation will do that later.',
    'Only use approved Vessel Master and Organization Chart actions.',
    'If the instruction asks for users, roles, passwords, SQL, config, security, access management, bulk delete, or Maritime Infinity, return unsupported.',
    'Resolve wording naturally: "give vessel to" means vessel assignment, "handle vessel" means assignment, "ops manager" means Crew Operations Manager, and "below/under" means parent or assignment based on entity type.',
    'If "manager" is ambiguous, ask a clarifying question instead of guessing.',
    'If a new vessel is missing vessel type or assignment, ask a clarifying question.',
    'The active hierarchy is Crew Director > Crew Operations Manager > Deputy Manager > Crew Manager. Assistants are not active and must never be proposed.',
    'A person may have a business designation different from the hierarchy role; preserve the hierarchy role and update only designation when requested.',
    'If confidence is below 0.65, provide a clarifyingQuestion.',
    `Allowed domains: ${allowedDomains.join(', ')}.`,
    `Allowed actions: ${modelAllowedActions.join(', ')}.`,
    'Return JSON only. No markdown.',
    '',
    'Schema:',
    JSON.stringify(aiPlanJsonShape(), null, 2),
    '',
    'Reference data:',
    JSON.stringify(compactReference),
  ].join('\n')
}

export function aiPlanJsonShape() {
  return {
    planSummary: 'short summary of the whole plan',
    actions: [aiJsonShape()],
  }
}

export function aiJsonShape() {
  return {
    domain: 'vessel_master | organization_chart | unsupported',
    action: modelAllowedActions.join(' | '),
    confidence: 'number from 0 to 1',
    reasoningSummary: 'short explanation of how the instruction was interpreted',
    target: {
      crewDirectorName: 'string or null',
      crewOperationsManagerName: 'string or null',
      deputyManagerName: 'string or null',
      crewManagerName: 'string or null',
      assistantName: 'string or null',
      vesselName: 'string or null',
    },
    data: {
      name: 'string or null',
      newName: 'string or null',
      designation: 'string or null',
      newDesignation: 'string or null',
      vesselName: 'string or null',
      newVesselName: 'string or null',
      vesselType: 'string or null',
      assignmentCrewManagerName: 'string or null',
      parentCrewDirectorName: 'string or null',
      parentCrewOperationsManagerName: 'string or null',
      parentDeputyManagerName: 'string or null',
      parentCrewManagerName: 'string or null',
      newParentCrewDirectorName: 'string or null',
      newParentCrewOperationsManagerName: 'string or null',
      newParentDeputyManagerName: 'string or null',
      newParentCrewManagerName: 'string or null',
    },
    clarifyingQuestion: 'string or null',
    summary: 'short human summary',
    warnings: ['string'],
  }
}
