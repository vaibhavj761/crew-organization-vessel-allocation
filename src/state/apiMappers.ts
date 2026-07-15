import type { ChartData, CrewDirectorNode, CrewManagerNode, DeputyManagerNode, OperationsManagerNode, Person, Vessel } from '../types'

type NullableString = string | null | undefined
type RawPerson = Partial<Person> & { id?: string }
type RawCrewManager = { id?: string; person?: RawPerson; vessels?: Array<{ id?: string }> }
type RawDeputyManager = { id?: string; operationsManagerId?: string; person?: RawPerson; crewManagers?: RawCrewManager[] }
type RawOperationsManager = { id?: string; crewDirectorId?: string; person?: RawPerson; deputyManagers?: RawDeputyManager[]; crewManagers?: RawCrewManager[] }
type RawCrewDirector = { id?: string; person?: RawPerson; operationsManagers?: RawOperationsManager[] }
type RawHierarchyResponse = { crewDirectors?: RawCrewDirector[] } | null | undefined
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

function mapCrewManager(raw: RawCrewManager, sortOrder: number): CrewManagerNode {
  return {
    id: raw?.id || `crew-manager-${sortOrder}`,
    sortOrder,
    person: mapPerson(raw?.person, 'CREW_MANAGER', raw?.person?.id || raw?.id || `crew-manager-${sortOrder}`, raw?.person?.name || 'New Crew Manager', raw?.person?.designation || 'Crew Manager'),
    vesselIds: (raw.vessels || []).map((vessel) => vessel?.id).filter((id): id is string => Boolean(id)),
  }
}

function mapDeputyManager(raw: RawDeputyManager, sortOrder: number): DeputyManagerNode {
  return {
    id: raw?.id || `deputy-manager-${sortOrder}`,
    operationsManagerId: raw?.operationsManagerId || '',
    sortOrder,
    person: mapPerson(raw?.person, 'DEPUTY_MANAGER', raw?.person?.id || raw?.id || `deputy-manager-${sortOrder}`, raw?.person?.name || 'New Deputy Manager', raw?.person?.designation || 'Deputy Crew Manager'),
    crewManagers: (raw.crewManagers || []).map((crewManager, index) => mapCrewManager(crewManager, index + 1)),
  }
}

function mapOperationsManager(raw: RawOperationsManager, sortOrder: number): OperationsManagerNode {
  const legacyCrewManagers = raw.crewManagers?.length
    ? [{ id: `${raw.id || `operations-manager-${sortOrder}`}-default-deputy`, operationsManagerId: raw.id, person: { name: 'Deputy Manager', designation: 'Deputy Crew Manager' }, crewManagers: raw.crewManagers }]
    : []
  return {
    id: raw?.id || `operations-manager-${sortOrder}`,
    crewDirectorId: raw?.crewDirectorId || '',
    sortOrder,
    person: mapPerson(raw?.person, 'OPERATIONS_MANAGER', raw?.person?.id || raw?.id || `operations-manager-${sortOrder}`, raw?.person?.name || 'New Operations Manager', raw?.person?.designation || 'Crew Operations Manager'),
    deputyManagers: (raw.deputyManagers || legacyCrewManagers).map((deputyManager, index) => mapDeputyManager({ ...deputyManager, operationsManagerId: raw?.id || `operations-manager-${sortOrder}` }, index + 1)),
  }
}

function mapCrewDirector(raw: RawCrewDirector, sortOrder: number): CrewDirectorNode {
  return {
    id: raw?.id || `crew-director-${sortOrder}`,
    sortOrder,
    person: mapPerson(raw?.person, 'CREW_DIRECTOR', raw?.person?.id || raw?.id || `crew-director-${sortOrder}`, raw?.person?.name || 'Crew Director', raw?.person?.designation || 'Crew Director'),
  }
}

export function mapHierarchyResponseToChartState(response: RawHierarchyResponse): Pick<ChartData, 'crewDirectors' | 'operationsManagers'> {
  const hierarchy = response || {}
  const crewDirectors = (hierarchy.crewDirectors || []).map((director, index) => mapCrewDirector(director, index + 1))
  return {
    crewDirectors,
    operationsManagers: (hierarchy.crewDirectors || []).flatMap((director, directorIndex) =>
      (director.operationsManagers || []).map((op, index) => mapOperationsManager({ ...op, crewDirectorId: director.id || `crew-director-${directorIndex + 1}` }, index + 1)),
    ),
  }
}

type RawOrganizationResponse = { organization?: OrganizationFields } | OrganizationFields | null | undefined

export function mapOrganizationResponseToChartState(response: RawOrganizationResponse): Pick<ChartData, 'title' | 'organizationName' | 'effectiveDate' | 'footerText'> {
  const organization = response && typeof response === 'object' && 'organization' in response
    ? (response.organization || {})
    : (response || {}) as OrganizationFields
  return {
    title: organization.title || 'Crew Operations Organization Chart',
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
    assignedAssistantId: '',
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

export function mapDeputyManagerToApiPayload(deputyManager: DeputyManagerNode) {
  return {
    ...mapPersonToApiPayload(deputyManager.person),
    sortOrder: deputyManager.sortOrder,
  }
}

export function mapOperationsManagerToApiPayload(operationsManager: OperationsManagerNode) {
  return {
    ...mapPersonToApiPayload(operationsManager.person),
    sortOrder: operationsManager.sortOrder,
  }
}

export function mapVesselToApiPayload(vessel: Vessel) {
  const trim = (value: string) => value.trim()
  return {
    name: trim(vessel.name),
    vesselType: trim(vessel.vesselType),
    vesselDoc: trim(vessel.vesselDoc),
    deadweightTonnage: trim(vessel.deadweightTonnage),
    ownerPool: trim(vessel.ownerPool),
    ownerName: trim(vessel.ownerName),
    vesselManager: trim(vessel.vesselManager),
    vesselStatus: vessel.vesselStatus,
    managementType: vessel.managementType,
    notes: trim(vessel.notes),
    sortOrder: vessel.sortOrder,
    crewManagerId: trim(vessel.crewManagerId),
    assignedAssistantId: '',
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
