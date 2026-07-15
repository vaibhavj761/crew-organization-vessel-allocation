export type WorkflowRole = 'CREW_DIRECTOR' | 'OPERATIONS_MANAGER' | 'DEPUTY_MANAGER' | 'CREW_MANAGER' | 'ASSISTANT'
export type ViewMode = 'dashboard' | 'overview' | 'operations' | 'vessels' | 'ai' | 'access'
export type VesselStatus = 'IN_MANAGEMENT' | 'UPCOMING' | 'OUT_OF_MANAGEMENT'
export type ManagementType = 'FULL_MANAGED' | 'CREW_MANAGED'

export interface Person {
  id: string; name: string; designation: string; workflowRole: WorkflowRole
  email: string; phone: string; notes: string
}
export interface Assistant extends Person { workflowRole: 'ASSISTANT'; sortOrder: number }
export interface CrewDirectorNode {
  id: string
  sortOrder: number
  person: Person & { workflowRole: 'CREW_DIRECTOR' }
}
export interface CrewManagerNode {
  id: string; sortOrder: number; person: Person & { workflowRole: 'CREW_MANAGER' }
  vesselIds: string[]
}
export interface DeputyManagerNode {
  id: string; sortOrder: number; person: Person & { workflowRole: 'DEPUTY_MANAGER' }
  operationsManagerId: string
  crewManagers: CrewManagerNode[]
}
export interface OperationsManagerNode {
  id: string; sortOrder: number; person: Person & { workflowRole: 'OPERATIONS_MANAGER' }
  crewDirectorId: string
  deputyManagers: DeputyManagerNode[]
}
export interface Vessel {
  id: string; name: string; vesselType: string; vesselDoc: string; deadweightTonnage: string
  ownerPool: string; ownerName: string; vesselManager: string; crewManagerId: string
  assignedAssistantId: string; vesselStatus: VesselStatus; managementType: ManagementType
  notes: string; sortOrder: number
}
export interface ChartData {
  schemaVersion: 2; title: string; organizationName: string; effectiveDate: string
  crewDirectors: CrewDirectorNode[]
  operationsManagers: OperationsManagerNode[]; vessels: Vessel[]; footerText: string
}

export interface SafeUser {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'EDITOR' | 'VIEWER' | 'BOSS_VIEWER'
  status: 'PENDING_APPROVAL' | 'APPROVED_NEEDS_PASSWORD' | 'ACTIVE' | 'REJECTED' | 'DISABLED'
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export interface VesselFilters {
  search: string; operationsManagerId: string; crewManagerId: string
  vesselStatus: '' | VesselStatus; managementType: '' | ManagementType
}

export type AiScope = 'auto' | 'vessel_master' | 'organization_chart'
export type AiPreviewStatus = 'ready' | 'needs_clarification' | 'blocked' | 'not_configured' | 'error'
export interface AiPreviewChange {
  entity: string
  field: string
  oldValue: string | null
  newValue: string | null
}
export interface AiPreviewResponse {
  previewId: string | null
  status: AiPreviewStatus
  domain: 'vessel_master' | 'organization_chart' | 'unsupported'
  action: string
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
  errorCategory?: 'missing_key' | 'invalid_key' | 'model_not_found' | 'rate_limit' | 'quota' | 'network' | 'invalid_response' | null
}

export interface AiStatusResponse {
  provider: 'openai' | 'claude' | 'gemini' | 'mock' | 'none'
  configured: boolean
  model: string
  understandingMode: 'llm-first' | 'local-parser' | 'disabled'
  fallbackEnabled: boolean
  lastProviderErrorCategory: 'missing_key' | 'invalid_key' | 'model_not_found' | 'rate_limit' | 'quota' | 'network' | 'invalid_response' | null
  lastProviderErrorMessage: string | null
  voiceInput: 'browser-only'
  previewStore: 'memory'
}
