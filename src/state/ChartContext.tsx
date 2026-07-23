import { createContext, type Dispatch, type ReactNode, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { ChartData, Person, Vessel } from '../types'
import { chartReducer, type ChartAction } from './chartReducer'
import { hierarchyApi } from '../api/hierarchy'
import { organizationApi } from '../api/organization'
import { vesselsApi } from '../api/vessels'
import { apiClient, ApiError } from '../api/client'
import {
  describeApiError,
  mapCrewManagerToApiPayload,
  mapDeputyManagerToApiPayload,
  mapHierarchyResponseToChartState,
  mapOperationsManagerToApiPayload,
  mapOrganizationResponseToChartState,
  mapPersonToApiPayload,
  mapVesselResponseListToChartVessels,
  mapVesselToApiPayload,
} from './apiMappers'
import { createEmptyChartData } from '../utils/createEmptyChartData'
import { getBlockingVesselValidationMessage, normalizeVesselTextFields } from '../utils/vesselValidation'

type LoadState = 'loading' | 'ready' | 'error'
type SaveState = 'saved' | 'saving' | 'error'
export type WorkspaceRefreshReason =
  | 'initial-login'
  | 'browser-bootstrap'
  | 'nav-click-dashboard'
  | 'nav-click-organization'
  | 'nav-click-operations'
  | 'nav-click-vessel-master'
  | 'nav-click-access-management'
  | 'manual-refresh'
  | 'filter-apply'
  | 'save-success'

const allowedRefreshReasons = new Set<WorkspaceRefreshReason>([
  'initial-login',
  'browser-bootstrap',
  'nav-click-dashboard',
  'nav-click-organization',
  'nav-click-operations',
  'nav-click-vessel-master',
  'nav-click-access-management',
  'manual-refresh',
  'filter-apply',
  'save-success',
])

const debugRefreshLogging = import.meta.env.DEV && import.meta.env.VITE_DEBUG_REFRESH === 'true'

interface ChartContextValue {
  data: ChartData
  dispatch: Dispatch<ChartAction>
  saveState: SaveState
  hasUnsavedChanges: boolean
  loadState: LoadState
  errorMessage: string
  syncNotice: string
  saveChanges: () => Promise<void>
  saveHierarchyPerson: (target: HierarchyPersonTarget, person: Person) => Promise<void>
  createHierarchyPerson: (target: HierarchyCreateTarget, person: Person) => Promise<void>
  createVesselRecord: (vessel: Vessel) => Promise<void>
  assignVesselFromChart: (vesselId: string, crewManagerId: string, crewManagerReportingLineId?: string) => Promise<void>
  unassignVesselFromChart: (vesselId: string) => Promise<void>
  saveVesselFromChart: (vessel: Vessel) => Promise<void>
  updateHierarchyPlacement: (payload: HierarchyPlacementPayload) => Promise<void>
  refreshWorkspaceData: (reason: WorkspaceRefreshReason) => Promise<void>
}

export type HierarchyPlacementPayload = {
  entityType: 'OPERATIONS_MANAGER' | 'DEPUTY_MANAGER' | 'CREW_MANAGER'
  entityId: string
  parentId: string
  parentPlacementId?: string
  action: 'MOVE' | 'COPY'
}

export type HierarchyPersonTarget =
  | { kind: 'crewDirector'; id: string }
  | { kind: 'operationsManager'; id: string }
  | { kind: 'deputyManager'; id: string; operationsManagerId: string }
  | { kind: 'crewManager'; id: string; deputyManagerId: string }

export type HierarchyCreateTarget =
  | { kind: 'crewDirector' }
  | { kind: 'operationsManager'; crewDirectorId: string }
  | { kind: 'deputyManager'; operationsManagerId: string; operationsManagerReportingLineId?: string }
  | { kind: 'crewManager'; deputyManagerId: string; deputyManagerReportingLineId?: string }

const ChartContext = createContext<ChartContextValue | null>(null)

function initialData(): ChartData {
  return createEmptyChartData()
}

function equalJson(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function uniqueEntitiesById<T extends { id: string; isPrimaryReportingLine?: boolean }>(items: T[]) {
  const entities = new Map<string, T>()
  for (const item of items) {
    const existing = entities.get(item.id)
    if (!existing || item.isPrimaryReportingLine === true) entities.set(item.id, item)
  }
  return Array.from(entities.values())
}

function toApiDateTime(date: string) {
  return date ? `${date}T00:00:00.000Z` : null
}

function normalizeApiError(error: unknown, fallback: string) {
  if (error instanceof ApiError) return describeApiError(error)
  return error instanceof Error ? error.message : fallback
}

function personFromApiResponse(response: unknown, fallback: Person): Person {
  const value = (response as { person?: Partial<Person> } | null)?.person
  return {
    ...fallback,
    ...value,
    id: value?.id || fallback.id,
    name: value?.name?.trim() || fallback.name,
    designation: value?.designation?.trim() || fallback.designation,
    email: value?.email || '',
    phone: value?.phone || '',
    notes: value?.notes || '',
    workflowRole: fallback.workflowRole,
  }
}

function logRefresh(reason: WorkspaceRefreshReason) {
  if (!debugRefreshLogging || typeof window === 'undefined') return
  console.info('[workspace-refresh]', {
    reason,
    at: new Date().toISOString(),
    route: window.location.pathname,
  })
}

export function ChartProvider({ children }: { children: ReactNode }) {
  const [data, reducerDispatch] = useReducer(chartReducer, undefined, initialData)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [errorMessage, setErrorMessage] = useState('')
  const [syncNotice, setSyncNotice] = useState('')
  const organizationIdRef = useRef('')
  const snapshotRef = useRef<ChartData | null>(null)
  const syncingRef = useRef(false)
  const editVersionRef = useRef(0)
  const loadRequestRef = useRef(0)

  const dispatch = useCallback((action: ChartAction) => {
    if (action.type !== 'replace') {
      editVersionRef.current += 1
      setErrorMessage('')
      setSaveState((current) => current === 'saving' ? current : 'saved')
    }
    reducerDispatch(action)
  }, [])

  const loadFromServer = useCallback(async (reason: WorkspaceRefreshReason, fresh = true) => {
    if (!allowedRefreshReasons.has(reason)) return
    logRefresh(reason)
    const requestId = ++loadRequestRef.current
    const editVersionAtStart = editVersionRef.current
    const isInitialLoad = !snapshotRef.current
    if (isInitialLoad) {
      setLoadState('loading')
    } else {
      setSyncNotice('Refreshing…')
    }
    setErrorMessage('')
    try {
      if (fresh) apiClient.clearGetRequestCache()
      const organizationResponse = await organizationApi.getOrganization(fresh) as Parameters<typeof mapOrganizationResponseToChartState>[0]
      organizationIdRef.current = (organizationResponse as { organization?: { id?: string } })?.organization?.id || ''
      if (!organizationIdRef.current) {
        const emptyState = createEmptyChartData()
        if (requestId !== loadRequestRef.current || editVersionRef.current !== editVersionAtStart) {
          if (isInitialLoad) setLoadState('ready')
          return
        }
        snapshotRef.current = emptyState
        dispatch({ type: 'replace', data: emptyState })
        setLoadState('ready')
        setSaveState('saved')
        setSyncNotice('')
        return
      }

      const [hierarchyResponse, vesselResponse] = await Promise.all([
        hierarchyApi.getHierarchy(fresh) as Promise<Parameters<typeof mapHierarchyResponseToChartState>[0]>,
        vesselsApi.getVessels(fresh) as Promise<Parameters<typeof mapVesselResponseListToChartVessels>[0]>,
      ])

      const organization = mapOrganizationResponseToChartState(organizationResponse)
      const hierarchy = mapHierarchyResponseToChartState(hierarchyResponse)
      const vessels = mapVesselResponseListToChartVessels(vesselResponse)

      const chartData: ChartData = {
        schemaVersion: 2,
        ...organization,
        ...hierarchy,
        vessels,
      }

      if (requestId !== loadRequestRef.current || editVersionRef.current !== editVersionAtStart) {
        if (isInitialLoad) setLoadState('ready')
        return
      }

      snapshotRef.current = chartData
      dispatch({ type: 'replace', data: chartData })
      setLoadState('ready')
      setSaveState('saved')
      setSyncNotice(isInitialLoad ? '' : 'Synced just now')
    } catch (error) {
      setLoadState(isInitialLoad ? 'error' : 'ready')
      setSaveState('error')
      setSyncNotice('')
      setErrorMessage(normalizeApiError(error, 'Failed to load chart data'))
    }
  }, [dispatch])

  const refreshWorkspaceData = useCallback(async (reason: WorkspaceRefreshReason) => {
    await loadFromServer(reason, true)
  }, [loadFromServer])

  const syncToServer = useCallback(async (current: ChartData, snapshot: ChartData | null) => {
    setSaveState('saving')
    setErrorMessage('')
    try {
      let organizationId = organizationIdRef.current
      const workingCopy = structuredClone(current)
      workingCopy.vessels = workingCopy.vessels.map(normalizeVesselTextFields)

      if (!snapshot || !equalJson(
        {
          title: workingCopy.title,
          organizationName: workingCopy.organizationName,
          effectiveDate: workingCopy.effectiveDate,
          footerText: workingCopy.footerText,
        },
        {
          title: snapshot.title,
          organizationName: snapshot.organizationName,
          effectiveDate: snapshot.effectiveDate,
          footerText: snapshot.footerText,
        },
      )) {
        const response = await organizationApi.updateOrganization({
          name: workingCopy.organizationName,
          title: workingCopy.title,
          effectiveDate: toApiDateTime(workingCopy.effectiveDate),
          footerText: workingCopy.footerText || null,
        }) as { organization?: { id?: string } }
        organizationId = response.organization?.id || organizationId
        organizationIdRef.current = organizationId
      }

      const needsOrganization = workingCopy.crewDirectors.length > 0 || workingCopy.operationsManagers.length > 0 || workingCopy.vessels.length > 0
      if (!organizationId) {
        if (needsOrganization) {
          throw new Error('Organization must be created before adding hierarchy or vessels.')
        }
        snapshotRef.current = workingCopy
        setSaveState('saved')
        await refreshWorkspaceData('save-success')
        return
      }

      const snapshotDirectors = new Map((snapshot?.crewDirectors || []).map((director) => [director.id, director]))
      const currentDirectors = workingCopy.crewDirectors
      for (const director of currentDirectors) {
        if (!snapshotDirectors.has(director.id)) {
          const created = await hierarchyApi.createCrewDirector({ organizationId, ...director.person, sortOrder: director.sortOrder } as never) as { id?: string; person?: { id?: string } }
          const previousDirectorId = director.id
          director.id = created.id || director.id
          director.person.id = created.person?.id || director.person.id
          workingCopy.operationsManagers.forEach((op) => {
            if (op.crewDirectorId === previousDirectorId) op.crewDirectorId = director.id
          })
        } else if (!equalJson({ person: director.person, sortOrder: director.sortOrder }, { person: snapshotDirectors.get(director.id)?.person, sortOrder: snapshotDirectors.get(director.id)?.sortOrder })) {
          await hierarchyApi.updateCrewDirector(director.id, { ...director.person, sortOrder: director.sortOrder } as never)
        }
      }

      const allCurrentOps = workingCopy.operationsManagers
      const allSnapshotOps = snapshot?.operationsManagers || []
      const currentOps = uniqueEntitiesById(allCurrentOps)
      const snapshotOpsList = uniqueEntitiesById(allSnapshotOps)
      const snapshotOps = new Map(snapshotOpsList.map((op) => [op.id, op]))
      for (const op of currentOps) {
        if (!snapshotOps.has(op.id)) {
          const created = await hierarchyApi.createOperationsManager({ organizationId, ...mapOperationsManagerToApiPayload(op), crewDirectorId: op.crewDirectorId } as never) as { id?: string; person?: { id?: string } }
          op.id = created.id || op.id
          op.person.id = created.person?.id || op.person.id
        } else if (!equalJson({ person: op.person, sortOrder: op.sortOrder, crewDirectorId: op.crewDirectorId }, { person: snapshotOps.get(op.id)?.person, sortOrder: snapshotOps.get(op.id)?.sortOrder, crewDirectorId: snapshotOps.get(op.id)?.crewDirectorId })) {
          await hierarchyApi.updateOperationsManager(op.id, { ...mapOperationsManagerToApiPayload(op), crewDirectorId: op.crewDirectorId } as never)
        }
      }

      const currentDeputies = uniqueEntitiesById(allCurrentOps.flatMap((op) => op.deputyManagers))
      const snapshotDeputiesList = uniqueEntitiesById(allSnapshotOps.flatMap((op) => op.deputyManagers))
      const snapshotDeputies = new Map(snapshotDeputiesList.map((deputy) => [deputy.id, deputy]))
      for (const deputy of currentDeputies) {
        const snapDeputy = snapshotDeputies.get(deputy.id)
        if (!snapDeputy) {
          const created = await hierarchyApi.createDeputyManager({ organizationId, operationsManagerId: deputy.operationsManagerId, ...mapDeputyManagerToApiPayload(deputy), sortOrder: deputy.sortOrder } as never) as { id?: string; person?: { id?: string } }
          deputy.id = created.id || deputy.id
          deputy.person.id = created.person?.id || deputy.person.id
        } else if (!equalJson({ person: deputy.person, sortOrder: deputy.sortOrder, operationsManagerId: deputy.operationsManagerId }, { person: snapDeputy.person, sortOrder: snapDeputy.sortOrder, operationsManagerId: snapDeputy.operationsManagerId })) {
          await hierarchyApi.updateDeputyManager(deputy.id, { ...mapDeputyManagerToApiPayload(deputy), operationsManagerId: deputy.operationsManagerId, sortOrder: deputy.sortOrder } as never)
        }
      }

      const currentCrewManagers = uniqueEntitiesById(allCurrentOps.flatMap((op) => op.deputyManagers.flatMap((deputy) => deputy.crewManagers)))
      const snapshotCrewManagers = new Map(
        uniqueEntitiesById(allSnapshotOps.flatMap((op) => op.deputyManagers.flatMap((deputy) => deputy.crewManagers)))
          .map((manager) => [manager.id, manager]),
      )
      for (const cm of currentCrewManagers) {
        const snapCrewManager = snapshotCrewManagers.get(cm.id)
        if (!snapCrewManager) {
          const created = await hierarchyApi.createCrewManager({ organizationId, deputyManagerId: cm.deputyManagerId || '', ...mapCrewManagerToApiPayload(cm), sortOrder: cm.sortOrder } as never) as { id?: string; person?: { id?: string } }
          const previousCrewManagerId = cm.id
          const previousPersonId = cm.person.id
          cm.id = created.id || cm.id
          cm.person.id = created.person?.id || cm.person.id
          workingCopy.vessels.forEach((vessel) => {
            if (vessel.crewManagerId === previousCrewManagerId || vessel.crewManagerId === previousPersonId) {
              vessel.crewManagerId = cm.id
            }
          })
        } else if (!equalJson({ person: cm.person, sortOrder: cm.sortOrder, deputyManagerId: cm.deputyManagerId }, { person: snapCrewManager.person, sortOrder: snapCrewManager.sortOrder, deputyManagerId: snapCrewManager.deputyManagerId })) {
          await hierarchyApi.updateCrewManager(cm.id, { ...mapCrewManagerToApiPayload(cm), deputyManagerId: cm.deputyManagerId, sortOrder: cm.sortOrder } as never)
        }
      }

      const snapshotVessels = new Map((snapshot?.vessels || []).map((vessel) => [vessel.id, vessel]))
      const currentVessels = new Map(workingCopy.vessels.map((vessel) => [vessel.id, vessel]))
      for (const vessel of workingCopy.vessels) {
        if (!snapshotVessels.has(vessel.id)) {
          const created = await vesselsApi.createVessel({ organizationId, ...mapVesselToApiPayload(vessel) } as never) as { id?: string }
          vessel.id = created.id || vessel.id
        } else if (!equalJson(mapVesselToApiPayload(vessel), mapVesselToApiPayload(snapshotVessels.get(vessel.id)!))) {
          await vesselsApi.updateVessel(vessel.id, { organizationId, ...mapVesselToApiPayload(vessel) } as never)
        }

      }

      const currentCrewManagerIds = new Set(currentCrewManagers.map((manager) => manager.id))
      for (const manager of snapshotCrewManagers.values()) {
        if (!currentCrewManagerIds.has(manager.id)) await hierarchyApi.deleteCrewManager(manager.id)
      }

      for (const vessel of snapshot?.vessels || []) {
        if (!currentVessels.has(vessel.id)) await vesselsApi.deleteVessel(vessel.id)
      }

      const currentDeputyIds = new Set(currentDeputies.map((deputy) => deputy.id))
      for (const deputy of snapshotDeputies.values()) {
        if (!currentDeputyIds.has(deputy.id)) await hierarchyApi.deleteDeputyManager(deputy.id)
      }

      const currentOpsMap = new Map(currentOps.map((op) => [op.id, op]))
      for (const op of snapshotOpsList) {
        if (!currentOpsMap.has(op.id)) await hierarchyApi.deleteOperationsManager(op.id)
      }

      const currentDirectorMap = new Map(currentDirectors.map((director) => [director.id, director]))
      for (const director of snapshot?.crewDirectors || []) {
        if (!currentDirectorMap.has(director.id)) await hierarchyApi.deleteCrewDirector(director.id)
      }

      snapshotRef.current = workingCopy
      setSaveState('saved')
      apiClient.clearGetRequestCache()
      await refreshWorkspaceData('save-success')
    } catch (error) {
      setSaveState('error')
      setErrorMessage(normalizeApiError(error, 'Failed to save changes'))
    }
  }, [refreshWorkspaceData])

  useEffect(() => {
    void refreshWorkspaceData('browser-bootstrap')
  }, [refreshWorkspaceData])

  const hasUnsavedChanges = useMemo(() => !(snapshotRef.current && equalJson(snapshotRef.current, data)), [data])

  const saveChanges = useCallback(async () => {
    if (loadState !== 'ready' || syncingRef.current) return
    if (snapshotRef.current && equalJson(snapshotRef.current, data)) {
      setSaveState('saved')
      setErrorMessage('')
      setSyncNotice('')
      return
    }
    const snapshotVessels = new Map((snapshotRef.current?.vessels || []).map((vessel) => [vessel.id, vessel]))
    const changedVessels = data.vessels.filter((vessel) => {
      const previous = snapshotVessels.get(vessel.id)
      return !previous || !equalJson(mapVesselToApiPayload(vessel), mapVesselToApiPayload(previous))
    })
    const vesselValidationMessage = getBlockingVesselValidationMessage(changedVessels)
    if (vesselValidationMessage) {
      setSaveState('error')
      setErrorMessage(vesselValidationMessage)
      setSyncNotice('')
      return
    }
    syncingRef.current = true
    await syncToServer(data, snapshotRef.current)
    syncingRef.current = false
  }, [data, loadState, syncToServer])

  const saveHierarchyPerson = useCallback(async (target: HierarchyPersonTarget, person: Person) => {
    if (loadState !== 'ready' || syncingRef.current) {
      throw new Error('Please wait for the current workspace operation to finish.')
    }
    if (snapshotRef.current && !equalJson(snapshotRef.current, data)) {
      throw new Error('Save or refresh your other pending changes before editing directly on the chart.')
    }

    const normalizedPerson = {
      ...person,
      name: person.name.trim(),
      designation: person.designation.trim(),
    }
    if (!normalizedPerson.name) throw new Error('Name is required.')
    if (!normalizedPerson.designation) throw new Error('Designation is required.')

    syncingRef.current = true
    setSaveState('saving')
    setErrorMessage('')
    setSyncNotice('Saving chart update…')
    try {
      let response: unknown
      let action: ChartAction
      if (target.kind === 'crewDirector') {
        response = await hierarchyApi.updateCrewDirector(target.id, normalizedPerson as never)
        action = { type: 'updateCrewDirector', id: target.id, value: personFromApiResponse(response, normalizedPerson) as never }
      } else if (target.kind === 'operationsManager') {
        response = await hierarchyApi.updateOperationsManager(target.id, normalizedPerson)
        action = { type: 'updateOperationsManager', id: target.id, value: personFromApiResponse(response, normalizedPerson) as never }
      } else if (target.kind === 'deputyManager') {
        response = await hierarchyApi.updateDeputyManager(target.id, normalizedPerson)
        action = { type: 'updateDeputyManager', operationsManagerId: target.operationsManagerId, id: target.id, value: personFromApiResponse(response, normalizedPerson) as never }
      } else {
        response = await hierarchyApi.updateCrewManager(target.id, normalizedPerson)
        action = { type: 'updateCrewManager', deputyManagerId: target.deputyManagerId, id: target.id, value: personFromApiResponse(response, normalizedPerson) as never }
      }

      if (snapshotRef.current) snapshotRef.current = chartReducer(snapshotRef.current, action)
      reducerDispatch(action)
      apiClient.clearGetRequestCache()
      setSaveState('saved')
      setSyncNotice('Saved to database')
    } catch (error) {
      const message = normalizeApiError(error, 'Failed to save chart update')
      setSaveState('error')
      setErrorMessage(message)
      setSyncNotice('')
      throw new Error(message)
    } finally {
      syncingRef.current = false
    }
  }, [data, loadState])

  const createHierarchyPerson = useCallback(async (target: HierarchyCreateTarget, person: Person) => {
    if (loadState !== 'ready' || syncingRef.current) {
      throw new Error('Please wait for the current workspace operation to finish.')
    }
    if (snapshotRef.current && !equalJson(snapshotRef.current, data)) {
      throw new Error('Save or refresh your other pending changes before adding a person directly on the chart.')
    }
    const organizationId = organizationIdRef.current
    if (!organizationId) throw new Error('Set up the organization before adding hierarchy records.')

    const normalizedPerson = {
      ...person,
      name: person.name.trim(),
      designation: person.designation.trim(),
      email: person.email.trim(),
      phone: person.phone.trim(),
      notes: person.notes.trim(),
    }
    if (!normalizedPerson.name) throw new Error('Name is required.')
    if (!normalizedPerson.designation) throw new Error('Designation is required.')

    syncingRef.current = true
    setSaveState('saving')
    setErrorMessage('')
    setSyncNotice('Adding hierarchy record…')
    try {
      const payload = { organizationId, ...mapPersonToApiPayload(normalizedPerson) }
      if (target.kind === 'crewDirector') {
        await hierarchyApi.createCrewDirector({ ...payload, workflowRole: 'CREW_DIRECTOR', sortOrder: data.crewDirectors.length + 1 } as never)
      } else if (target.kind === 'operationsManager') {
        const siblingCount = data.operationsManagers.filter((item) => item.crewDirectorId === target.crewDirectorId).length
        await hierarchyApi.createOperationsManager({ ...payload, workflowRole: 'OPERATIONS_MANAGER', crewDirectorId: target.crewDirectorId, sortOrder: siblingCount + 1 } as never)
      } else if (target.kind === 'deputyManager') {
        const parent = data.operationsManagers.find((item) => item.id === target.operationsManagerId)
        await hierarchyApi.createDeputyManager({ ...payload, workflowRole: 'DEPUTY_MANAGER', operationsManagerId: target.operationsManagerId, operationsManagerReportingLineId: target.operationsManagerReportingLineId, sortOrder: (parent?.deputyManagers.length || 0) + 1 } as never)
      } else {
        const parent = data.operationsManagers.flatMap((item) => item.deputyManagers).find((item) => item.id === target.deputyManagerId)
        await hierarchyApi.createCrewManager({ ...payload, workflowRole: 'CREW_MANAGER', deputyManagerId: target.deputyManagerId, deputyManagerReportingLineId: target.deputyManagerReportingLineId, sortOrder: (parent?.crewManagers.length || 0) + 1 } as never)
      }
      apiClient.clearGetRequestCache()
      await refreshWorkspaceData('save-success')
      setSaveState('saved')
      setSyncNotice('Added and saved to database')
    } catch (error) {
      const message = normalizeApiError(error, 'Failed to add hierarchy record')
      setSaveState('error')
      setErrorMessage(message)
      setSyncNotice('')
      throw new Error(message)
    } finally {
      syncingRef.current = false
    }
  }, [data, loadState, refreshWorkspaceData])

  const runConfirmedVesselWrite = useCallback(async (notice: string, operation: () => Promise<unknown>) => {
    if (loadState !== 'ready' || syncingRef.current) throw new Error('Please wait for the current workspace operation to finish.')
    if (snapshotRef.current && !equalJson(snapshotRef.current, data)) {
      throw new Error('Save or refresh your other pending changes before updating a vessel directly on the chart.')
    }
    syncingRef.current = true
    setSaveState('saving')
    setErrorMessage('')
    setSyncNotice(notice)
    try {
      await operation()
      apiClient.clearGetRequestCache()
      await refreshWorkspaceData('save-success')
      setSaveState('saved')
      setSyncNotice('Saved to database')
    } catch (error) {
      const message = normalizeApiError(error, 'Failed to update vessel allocation')
      setSaveState('error')
      setErrorMessage(message)
      setSyncNotice('')
      throw new Error(message)
    } finally {
      syncingRef.current = false
    }
  }, [data, loadState, refreshWorkspaceData])

  const assignVesselFromChart = useCallback(async (vesselId: string, crewManagerId: string, crewManagerReportingLineId?: string) => {
    if (!vesselId) throw new Error('Select a vessel to assign.')
    if (!crewManagerId) throw new Error('Select a Crew Manager.')
    if (!crewManagerReportingLineId) throw new Error('Select the Crew Manager reporting path.')
    await runConfirmedVesselWrite('Assigning vessel…', () => vesselsApi.updateVesselAllocation(vesselId, { crewManagerId, crewManagerReportingLineId }))
  }, [runConfirmedVesselWrite])

  const unassignVesselFromChart = useCallback(async (vesselId: string) => {
    if (!vesselId) throw new Error('Select a vessel to remove from this allocation.')
    await runConfirmedVesselWrite('Removing vessel allocation…', () => vesselsApi.deleteVesselAllocation(vesselId))
  }, [runConfirmedVesselWrite])

  const saveVesselFromChart = useCallback(async (vessel: Vessel) => {
    const normalized = normalizeVesselTextFields(vessel)
    const validationMessage = getBlockingVesselValidationMessage([normalized])
    if (validationMessage) throw new Error(validationMessage)
    await runConfirmedVesselWrite('Updating vessel details…', () => vesselsApi.updateVessel(normalized.id, mapVesselToApiPayload(normalized)))
  }, [runConfirmedVesselWrite])

  const createVesselRecord = useCallback(async (vessel: Vessel) => {
    const normalized = normalizeVesselTextFields(vessel)
    const validationMessage = getBlockingVesselValidationMessage([normalized])
    if (validationMessage) throw new Error(validationMessage)
    const organizationId = organizationIdRef.current
    if (!organizationId) throw new Error('Set up the organization before adding vessels.')
    await runConfirmedVesselWrite('Adding vessel…', () => vesselsApi.createVessel({ organizationId, ...mapVesselToApiPayload(normalized) } as never))
  }, [runConfirmedVesselWrite])

  const updateHierarchyPlacement = useCallback(async (payload: HierarchyPlacementPayload) => {
    if (loadState !== 'ready' || syncingRef.current) throw new Error('Please wait for the current workspace operation to finish.')
    if (snapshotRef.current && !equalJson(snapshotRef.current, data)) {
      throw new Error('Save or refresh your pending edits before changing reporting lines.')
    }
    syncingRef.current = true
    setSaveState('saving')
    setErrorMessage('')
    setSyncNotice(payload.action === 'COPY' ? 'Adding reporting relationship…' : 'Moving reporting relationship…')
    try {
      await hierarchyApi.updatePlacement(payload)
      apiClient.clearGetRequestCache()
      await refreshWorkspaceData('save-success')
    } catch (error) {
      const message = normalizeApiError(error, 'Could not update the reporting relationship.')
      setSaveState('error')
      setErrorMessage(message)
      setSyncNotice('')
      throw new Error(message)
    } finally {
      syncingRef.current = false
    }
  }, [data, loadState, refreshWorkspaceData])

  const value = useMemo(
    () => ({ data, dispatch, saveState, hasUnsavedChanges, loadState, errorMessage, syncNotice, saveChanges, saveHierarchyPerson, createHierarchyPerson, createVesselRecord, assignVesselFromChart, unassignVesselFromChart, saveVesselFromChart, updateHierarchyPlacement, refreshWorkspaceData }),
    [data, dispatch, saveState, hasUnsavedChanges, loadState, errorMessage, syncNotice, saveChanges, saveHierarchyPerson, createHierarchyPerson, createVesselRecord, assignVesselFromChart, unassignVesselFromChart, saveVesselFromChart, updateHierarchyPlacement, refreshWorkspaceData],
  )

  return <ChartContext.Provider value={value}>{children}</ChartContext.Provider>
}

export function useChart() {
  const context = useContext(ChartContext)
  if (!context) throw new Error('useChart must be used within ChartProvider')
  return context
}
