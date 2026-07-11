import { z } from 'zod'

export const aiDomainSchema = z.enum(['vessel_master', 'organization_chart', 'unsupported'])
export const aiActionSchema = z.enum([
  'create_vessel',
  'update_vessel_name',
  'update_vessel_type',
  'update_vessel_assignment',
  'create_crew_director',
  'update_crew_director_name',
  'remove_crew_director',
  'create_crew_operations_manager',
  'update_crew_operations_manager_name',
  'move_crew_operations_manager',
  'remove_crew_operations_manager',
  'create_crew_manager',
  'update_crew_manager_name',
  'move_crew_manager',
  'remove_crew_manager',
  'create_assistant',
  'update_assistant_name',
  'move_assistant',
  'remove_assistant',
  'unsupported',
])

const nullableText = z.string().nullable()

export const aiStructuredActionSchema = z.object({
  domain: aiDomainSchema,
  action: aiActionSchema,
  confidence: z.number().min(0).max(1),
  reasoningSummary: z.string().optional().default(''),
  target: z.object({
    crewDirectorName: nullableText,
    crewOperationsManagerName: nullableText,
    crewManagerName: nullableText,
    assistantName: nullableText,
    vesselName: nullableText,
  }),
  data: z.object({
    name: nullableText,
    newName: nullableText,
    vesselName: nullableText,
    newVesselName: nullableText,
    vesselType: nullableText,
    assignmentCrewManagerName: nullableText,
    parentCrewDirectorName: nullableText,
    parentCrewOperationsManagerName: nullableText,
    parentCrewManagerName: nullableText,
    newParentCrewDirectorName: nullableText,
    newParentCrewOperationsManagerName: nullableText,
    newParentCrewManagerName: nullableText,
  }),
  clarifyingQuestion: nullableText,
  summary: z.string(),
  warnings: z.array(z.string()),
})

export const aiPreviewStatusSchema = z.enum(['ready', 'needs_clarification', 'blocked', 'not_configured', 'error'])

export type AiStructuredAction = z.infer<typeof aiStructuredActionSchema>
export type AiPreviewStatus = z.infer<typeof aiPreviewStatusSchema>
export type AiDomain = z.infer<typeof aiDomainSchema>
export type AiAction = z.infer<typeof aiActionSchema>

export type AiPreviewChange = {
  entity: string
  field: string
  oldValue: string | null
  newValue: string | null
}

export type AiPreviewResponse = {
  previewId: string | null
  status: AiPreviewStatus
  domain: AiDomain
  action: AiAction
  summary: string
  confidence: number
  reasoningSummary: string
  providerUsed: 'openai' | 'claude' | 'gemini' | 'mock' | 'none'
  fallbackUsed: boolean
  fallbackReason: string | null
  changes: AiPreviewChange[]
  warnings: string[]
  clarifyingQuestion: string | null
  requiresConfirmation: boolean
}

export type AiPreviewRecord = AiPreviewResponse & {
  previewId: string
  userId: string
  prompt: string
  structuredAction: AiStructuredAction
  referenceHash: string
  expiresAt: number
  affectedEntityType: string
  affectedEntityId: string | null
  resolvedIds: Record<string, string | null>
}
