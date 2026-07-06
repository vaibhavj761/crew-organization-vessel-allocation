import type { Assistant, ChartData, CrewManagerNode, OperationsManagerNode, Person, Vessel } from '../types'

type NullableString = string | null | undefined
type RawPerson = Partial<Person> & { id?: string }
type RawAssistant = { id?: string; person?: RawPerson }
type RawCrewManager = { id?: string; person?: RawPerson; assistants?: RawAssistant[]; vessels?: Array<{ id?: string }> }
type RawOperationsManager = { id?: string; person?: RawPerson; crewManagers?: RawCrewManager[] }
type RawHierarchyResponse = { crewDirector?: RawPerson; operationsManagers?: RawOperationsManager[] } | null | undefined
type RawVesselAllocation = { crewManagerId?: string; assignedAssistantId?: string | null }
type RawVessel = {
  id?: string
  name?: string
  vesselType?: NullableString
  vesselDoc?: NullableString
  deadweightTonnage?: NullableString
  ownerPool?: NullableString
  ownerName?: NullableString
  vesselManager?: NullableString
  currentAllocation?: RawVesselAllocation | null
  vesselStatus?: Vessel['vesselStatus']
  managementType?: Vessel['managementType']
  notes?: NullableString
}
type OrganizationFields = { title?: NullableString; name?: NullableString; effectiveDate?: NullableString; footerText?: NullableString }

const text = (value: NullableString) => value || ''

function mapPerson<R extends Person['workflowRole']>(person: RawPerson | undefined, role: R, fallbackId: string, fallbackName: string, fallbackDesignation: string): Person & { workflowRole: R } {
  return {
    id: person?.id || fallbackId,
    name: person?.name || fallbackName,
    designation: person?.designation || fallbackDesignation,
    workflowRole: role,
    email: text(person?.email),
    phone: text(person?.phone),
    notes: text(person?.notes),
  }
}

function mapAssistant(raw: RawAssistant, sortOrder: number): Assistant {
  return {
    ...mapPerson(raw?.person, 'ASSISTANT', raw?.id || `assistant-${sortOrder}`, raw?.person?.name || 'New Assistant', raw?.person?.designation || 'Assistant Crew Manager'),
    id: raw?.id || raw?.person?.id || `assistant-${sortOrder}`,
    sortOrder,
  }
}

function mapCrewManager(raw: RawCrewManager, sortOrder: number): CrewManagerNode {
  return {
    id: raw?.id || `crew-manager-${sortOrder}`,
    sortOrder,
    person: mapPerson(raw?.person, 'CREW_MANAGER', raw?.person?.id || raw?.id || `crew-manager-${sortOrder}`, raw?.person?.name || 'New Crew Manager', raw?.person?.designation || 'Crew Manager'),
    assistants: (raw.assistants || []).map((assistant, index) => mapAssistant(assistant, index + 1)),
    vesselIds: (raw.vessels || []).map((vessel) => vessel?.id).filter((id): id is string => Boolean(id)),
  }
}

function mapOperationsManager(raw: RawOperationsManager, sortOrder: number): OperationsManagerNode {
  return {
    id: raw?.id || `operations-manager-${sortOrder}`,
    sortOrder,
    person: mapPerson(raw?.person, 'OPERATIONS_MANAGER', raw?.person?.id || raw?.id || `operations-manager-${sortOrder}`, raw?.person?.name || 'New Operations Manager', raw?.person?.designation || 'Crew Operations Manager'),
    crewManagers: (raw.crewManagers || []).map((crewManager, index) => mapCrewManager(crewManager, index + 1)),
  }
}

export function mapHierarchyResponseToChartState(response: RawHierarchyResponse): Pick<ChartData, 'crewDirector' | 'operationsManagers'> {
  const hierarchy = response || {}
  return {
    crewDirector: mapPerson(hierarchy.crewDirector, 'CREW_DIRECTOR', hierarchy.crewDirector?.id || 'director', hierarchy.crewDirector?.name || 'Crew Director', hierarchy.crewDirector?.designation || 'Crew Director'),
    operationsManagers: (hierarchy.operationsManagers || []).map((op, index) => mapOperationsManager(op, index + 1)),
  }
}

type RawOrganizationResponse = { organization?: OrganizationFields } | OrganizationFields | null | undefined

export function mapOrganizationResponseToChartState(response: RawOrganizationResponse): Pick<ChartData, 'title' | 'organizationName' | 'effectiveDate' | 'footerText'> {
  const organization = response && typeof response === 'object' && 'organization' in response
    ? (response.organization || {})
    : (response || {}) as OrganizationFields
  return {
    title: organization.title || 'Crew Organization and Vessel Allocation Planner',
    organizationName: organization.name || 'Organization',
    effectiveDate: organization.effectiveDate ? String(organization.effectiveDate).slice(0, 10) : '',
    footerText: organization.footerText || '',
  }
}

export function mapVesselResponseToVessel(raw: RawVessel, sortOrder: number): Vessel {
  const currentAllocation = raw.currentAllocation || null
  return {
    id: raw?.id || `vessel-${sortOrder}`,
    name: raw?.name || 'Unnamed vessel',
    vesselType: text(raw?.vesselType),
    vesselDoc: text(raw?.vesselDoc),
    deadweightTonnage: text(raw?.deadweightTonnage),
    ownerPool: text(raw?.ownerPool),
    ownerName: text(raw?.ownerName),
    vesselManager: text(raw?.vesselManager),
    crewManagerId: currentAllocation?.crewManagerId || '',
    assignedAssistantId: currentAllocation?.assignedAssistantId || '',
    vesselStatus: raw?.vesselStatus || 'UPCOMING',
    managementType: raw?.managementType || 'FULL_MANAGED',
    notes: text(raw?.notes),
    sortOrder,
  }
}

export function mapVesselResponseListToChartVessels(response: { vessels?: RawVessel[] } | RawVessel[] | null | undefined): Vessel[] {
  const vessels = Array.isArray(response) ? response : response?.vessels || []
  return vessels.map((vessel, index) => mapVesselResponseToVessel(vessel, index + 1))
}

export function mapPersonToApiPayload(person: Person) {
  return {
    name: person.name,
    designation: person.designation,
    workflowRole: person.workflowRole,
    email: text(person.email),
    phone: text(person.phone),
    notes: text(person.notes),
  }
}

export function mapCrewManagerToApiPayload(crewManager: CrewManagerNode) {
  return mapPersonToApiPayload(crewManager.person)
}

export function mapOperationsManagerToApiPayload(operationsManager: OperationsManagerNode) {
  return {
    ...mapPersonToApiPayload(operationsManager.person),
    sortOrder: operationsManager.sortOrder,
  }
}

export function mapAssistantToApiPayload(assistant: Assistant) {
  return {
    ...mapPersonToApiPayload(assistant),
    sortOrder: assistant.sortOrder,
  }
}

export function mapVesselToApiPayload(vessel: Vessel) {
  return {
    name: vessel.name,
    vesselType: text(vessel.vesselType),
    vesselDoc: text(vessel.vesselDoc),
    deadweightTonnage: text(vessel.deadweightTonnage),
    ownerPool: text(vessel.ownerPool),
    ownerName: text(vessel.ownerName),
    vesselManager: text(vessel.vesselManager),
    vesselStatus: vessel.vesselStatus,
    managementType: vessel.managementType,
    notes: text(vessel.notes),
    sortOrder: vessel.sortOrder,
  }
}

export function describeApiError(error: unknown) {
  if (!error || typeof error !== 'object') return 'Unable to reach the server'
  const anyError = error as { status?: number; message?: string }
  if (anyError.status === 401) return 'Your session expired. Please sign in again.'
  if (anyError.status === 403) return 'You do not have permission to perform that action.'
  if (anyError.status === 404) return 'The requested record could not be found.'
  if (anyError.status === 422) return 'The server rejected part of the submitted data.'
  if (anyError.status && anyError.status >= 500) return 'The server is temporarily unavailable.'
  return anyError.message || 'Unable to reach the server'
}
