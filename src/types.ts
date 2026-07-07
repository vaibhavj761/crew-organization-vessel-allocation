export type WorkflowRole = 'CREW_DIRECTOR' | 'OPERATIONS_MANAGER' | 'CREW_MANAGER' | 'ASSISTANT'
export type ViewMode = 'dashboard' | 'overview' | 'operations' | 'vessels' | 'access'
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
  assistants: Assistant[]; vesselIds: string[]
}
export interface OperationsManagerNode {
  id: string; sortOrder: number; person: Person & { workflowRole: 'OPERATIONS_MANAGER' }
  crewDirectorId: string
  crewManagers: CrewManagerNode[]
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
