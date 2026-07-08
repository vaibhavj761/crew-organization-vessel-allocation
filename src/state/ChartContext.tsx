import { createContext, type Dispatch, type ReactNode, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { ChartData } from '../types'
import { chartReducer, type ChartAction } from './chartReducer'
import { hierarchyApi } from '../api/hierarchy'
import { organizationApi } from '../api/organization'
import { vesselsApi } from '../api/vessels'
import { apiClient, ApiError } from '../api/client'
import {
  describeApiError,
  mapAssistantToApiPayload,
  mapCrewManagerToApiPayload,
  mapHierarchyResponseToChartState,
  mapOperationsManagerToApiPayload,
  mapOrganizationResponseToChartState,
  mapVesselResponseListToChartVessels,
  mapVesselToApiPayload,
} from './apiMappers'
import { createEmptyChartData } from '../utils/createEmptyChartData'

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
  refreshWorkspaceData: (reason: WorkspaceRefreshReason) => Promise<void>
}

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
        const snapCrew = new Map((snapOp?.crewManagers || []).map((cm) => [cm.id, cm]))
        for (const cm of op.crewManagers) {
          if (!snapCrew.has(cm.id)) {
            const created = await hierarchyApi.createCrewManager({ organizationId, operationsManagerId: op.id, ...mapCrewManagerToApiPayload(cm), sortOrder: cm.sortOrder } as never) as { id?: string; person?: { id?: string } }
            const previousCrewManagerId = cm.id
            const previousPersonId = cm.person.id
            cm.id = created.id || cm.id
            cm.person.id = created.person?.id || cm.person.id
            workingCopy.vessels.forEach((vessel) => {
              if (vessel.crewManagerId === previousCrewManagerId || vessel.crewManagerId === previousPersonId) {
                vessel.crewManagerId = cm.id
              }
            })
          } else if (!equalJson({ person: cm.person, sortOrder: cm.sortOrder, operationsManagerId: op.id }, { person: snapCrew.get(cm.id)?.person, sortOrder: snapCrew.get(cm.id)?.sortOrder, operationsManagerId: snapOp?.id })) {
            await hierarchyApi.updateCrewManager(cm.id, { ...mapCrewManagerToApiPayload(cm), operationsManagerId: op.id, sortOrder: cm.sortOrder } as never)
          }
        }

        for (const cm of op.crewManagers) {
          const snapCm = snapCrew.get(cm.id)
          const snapAssistants = new Map((snapCm?.assistants || []).map((assistant) => [assistant.id, assistant]))
          for (const assistant of cm.assistants) {
            if (!snapAssistants.has(assistant.id)) {
              const created = await hierarchyApi.createAssistant({ organizationId, crewManagerId: cm.id, ...mapAssistantToApiPayload(assistant) } as never) as { id?: string; person?: { id?: string } }
              const previousAssistantId = assistant.id
              assistant.id = created.id || assistant.id
              workingCopy.vessels.forEach((vessel) => {
                if (vessel.assignedAssistantId === previousAssistantId) {
                  vessel.assignedAssistantId = assistant.id
                }
              })
            } else if (!equalJson({ assistant, crewManagerId: cm.id }, { assistant: snapAssistants.get(assistant.id), crewManagerId: snapCm?.id })) {
              await hierarchyApi.updateAssistant(assistant.id, { crewManagerId: cm.id, ...mapAssistantToApiPayload(assistant) } as never)
            }
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

        const snap = snapshotVessels.get(vessel.id)
        if (!snap || vessel.crewManagerId !== snap.crewManagerId || vessel.assignedAssistantId !== snap.assignedAssistantId) {
          await vesselsApi.updateVesselAllocation(vessel.id, {
            crewManagerId: vessel.crewManagerId || null,
            assignedAssistantId: vessel.assignedAssistantId || null,
          })
        }
      }

      for (const snapOp of snapshot?.operationsManagers || []) {
        for (const snapCm of snapOp.crewManagers || []) {
          const currentCm = currentOps.flatMap((op) => op.crewManagers).find((cm) => cm.id === snapCm.id)
          const currentAssistants = new Map((currentCm?.assistants || []).map((assistant) => [assistant.id, assistant]))
          for (const assistant of snapCm.assistants || []) {
            if (!currentAssistants.has(assistant.id)) await hierarchyApi.deleteAssistant(assistant.id)
          }
        }
      }

      for (const snapOp of snapshot?.operationsManagers || []) {
        const currentOp = currentOps.find((op) => op.id === snapOp.id)
        const currentCrew = new Map((currentOp?.crewManagers || []).map((cm) => [cm.id, cm]))
        for (const cm of snapOp.crewManagers || []) {
          if (!currentCrew.has(cm.id)) await hierarchyApi.deleteCrewManager(cm.id)
        }
      }

      for (const vessel of snapshot?.vessels || []) {
        if (!currentVessels.has(vessel.id)) await vesselsApi.deleteVessel(vessel.id)
      }

      const currentOpsMap = new Map(currentOps.map((op) => [op.id, op]))
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
    syncingRef.current = true
    await syncToServer(data, snapshotRef.current)
    syncingRef.current = false
  }, [data, loadState, syncToServer])

  const value = useMemo(
    () => ({ data, dispatch, saveState, hasUnsavedChanges, loadState, errorMessage, syncNotice, saveChanges, refreshWorkspaceData }),
    [data, dispatch, saveState, hasUnsavedChanges, loadState, errorMessage, syncNotice, saveChanges, refreshWorkspaceData],
  )

  return <ChartContext.Provider value={value}>{children}</ChartContext.Provider>
}

export function useChart() {
  const context = useContext(ChartContext)
  if (!context) throw new Error('useChart must be used within ChartProvider')
  return context
}
