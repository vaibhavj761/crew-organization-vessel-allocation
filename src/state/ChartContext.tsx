import { createContext, type Dispatch, type ReactNode, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { ChartData, Person } from '../types'
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
  refreshWorkspaceData: (reason: WorkspaceRefreshReason) => Promise<void>
}

export type HierarchyPersonTarget =
  | { kind: 'crewDirector'; id: string }
  | { kind: 'operationsManager'; id: string }
  | { kind: 'deputyManager'; id: string; operationsManagerId: string }
  | { kind: 'crewManager'; id: string; deputyManagerId: string }

const ChartContext = createContext<ChartContextValue | null>(null)

function initialData(): ChartData {
  return createEmptyChartData()
}

function equalJson(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b)
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

      const currentOps = workingCopy.operationsManagers
      const snapshotOps = new Map((snapshot?.operationsManagers || []).map((op) => [op.id, op]))
      for (const op of currentOps) {
        if (!snapshotOps.has(op.id)) {
          const created = await hierarchyApi.createOperationsManager({ organizationId, ...mapOperationsManagerToApiPayload(op), crewDirectorId: op.crewDirectorId } as never) as { id?: string; person?: { id?: string } }
          op.id = created.id || op.id
          op.person.id = created.person?.id || op.person.id
        } else if (!equalJson({ person: op.person, sortOrder: op.sortOrder, crewDirectorId: op.crewDirectorId }, { person: snapshotOps.get(op.id)?.person, sortOrder: snapshotOps.get(op.id)?.sortOrder, crewDirectorId: snapshotOps.get(op.id)?.crewDirectorId })) {
          await hierarchyApi.updateOperationsManager(op.id, { ...mapOperationsManagerToApiPayload(op), crewDirectorId: op.crewDirectorId } as never)
        }
      }

      for (const op of currentOps) {
        const snapOp = snapshotOps.get(op.id)
        const snapDeputies = new Map((snapOp?.deputyManagers || []).map((deputy) => [deputy.id, deputy]))
        for (const deputy of op.deputyManagers) {
          if (!snapDeputies.has(deputy.id)) {
            const created = await hierarchyApi.createDeputyManager({ organizationId, operationsManagerId: op.id, ...mapDeputyManagerToApiPayload(deputy), sortOrder: deputy.sortOrder } as never) as { id?: string; person?: { id?: string } }
            deputy.id = created.id || deputy.id
            deputy.person.id = created.person?.id || deputy.person.id
            deputy.operationsManagerId = op.id
          } else if (!equalJson({ person: deputy.person, sortOrder: deputy.sortOrder, operationsManagerId: op.id }, { person: snapDeputies.get(deputy.id)?.person, sortOrder: snapDeputies.get(deputy.id)?.sortOrder, operationsManagerId: snapOp?.id })) {
            await hierarchyApi.updateDeputyManager(deputy.id, { ...mapDeputyManagerToApiPayload(deputy), operationsManagerId: op.id, sortOrder: deputy.sortOrder } as never)
          }
        }
      }

      const currentDeputies = currentOps.flatMap((op) => op.deputyManagers)
      const snapshotDeputies = new Map((snapshot?.operationsManagers || []).flatMap((op) => op.deputyManagers).map((deputy) => [deputy.id, deputy]))
      for (const deputy of currentDeputies) {
        const snapDeputy = snapshotDeputies.get(deputy.id)
        const snapCrew = new Map((snapDeputy?.crewManagers || []).map((cm) => [cm.id, cm]))
        for (const cm of deputy.crewManagers) {
          if (!snapCrew.has(cm.id)) {
            const created = await hierarchyApi.createCrewManager({ organizationId, deputyManagerId: deputy.id, ...mapCrewManagerToApiPayload(cm), sortOrder: cm.sortOrder } as never) as { id?: string; person?: { id?: string } }
            const previousCrewManagerId = cm.id
            const previousPersonId = cm.person.id
            cm.id = created.id || cm.id
            cm.person.id = created.person?.id || cm.person.id
            workingCopy.vessels.forEach((vessel) => {
              if (vessel.crewManagerId === previousCrewManagerId || vessel.crewManagerId === previousPersonId) {
                vessel.crewManagerId = cm.id
              }
            })
          } else if (!equalJson({ person: cm.person, sortOrder: cm.sortOrder, deputyManagerId: deputy.id }, { person: snapCrew.get(cm.id)?.person, sortOrder: snapCrew.get(cm.id)?.sortOrder, deputyManagerId: snapDeputy?.id })) {
            await hierarchyApi.updateCrewManager(cm.id, { ...mapCrewManagerToApiPayload(cm), deputyManagerId: deputy.id, sortOrder: cm.sortOrder } as never)
          }
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

      for (const snapOp of snapshot?.operationsManagers || []) {
        for (const snapDeputy of snapOp.deputyManagers || []) {
          const currentDeputy = currentDeputies.find((deputy) => deputy.id === snapDeputy.id)
          const currentCrew = new Map((currentDeputy?.crewManagers || []).map((cm) => [cm.id, cm]))
          for (const cm of snapDeputy.crewManagers || []) {
            if (!currentCrew.has(cm.id)) await hierarchyApi.deleteCrewManager(cm.id)
          }
        }
      }

      for (const vessel of snapshot?.vessels || []) {
        if (!currentVessels.has(vessel.id)) await vesselsApi.deleteVessel(vessel.id)
      }

      const currentOpsMap = new Map(currentOps.map((op) => [op.id, op]))
      for (const snapOp of snapshot?.operationsManagers || []) {
        const currentOp = currentOpsMap.get(snapOp.id)
        const currentDeputyMap = new Map((currentOp?.deputyManagers || []).map((deputy) => [deputy.id, deputy]))
        for (const deputy of snapOp.deputyManagers || []) {
          if (!currentDeputyMap.has(deputy.id)) await hierarchyApi.deleteDeputyManager(deputy.id)
        }
      }

      for (const op of snapshot?.operationsManagers || []) {
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
    const vesselValidationMessage = getBlockingVesselValidationMessage(data.vessels)
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

  const value = useMemo(
    () => ({ data, dispatch, saveState, hasUnsavedChanges, loadState, errorMessage, syncNotice, saveChanges, saveHierarchyPerson, refreshWorkspaceData }),
    [data, dispatch, saveState, hasUnsavedChanges, loadState, errorMessage, syncNotice, saveChanges, saveHierarchyPerson, refreshWorkspaceData],
  )

  return <ChartContext.Provider value={value}>{children}</ChartContext.Provider>
}

export function useChart() {
  const context = useContext(ChartContext)
  if (!context) throw new Error('useChart must be used within ChartProvider')
  return context
}
