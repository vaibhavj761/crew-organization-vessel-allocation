import { createContext, type Dispatch, type ReactNode, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { sampleData } from '../data/sampleData'
import type { ChartData } from '../types'
import { chartReducer, type ChartAction } from './chartReducer'
import { hierarchyApi } from '../api/hierarchy'
import { organizationApi } from '../api/organization'
import { vesselsApi } from '../api/vessels'
import { ApiError } from '../api/client'
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

type LoadState = 'loading' | 'ready' | 'error'
type SaveState = 'saved' | 'saving' | 'error'

interface ChartContextValue {
  data: ChartData
  dispatch: Dispatch<ChartAction>
  saveState: SaveState
  hasUnsavedChanges: boolean
  loadState: LoadState
  errorMessage: string
  saveChanges: () => Promise<void>
  reloadFromServer: () => Promise<void>
}

const ChartContext = createContext<ChartContextValue | null>(null)

function initialData(): ChartData {
  return structuredClone(sampleData)
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

export function ChartProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(chartReducer, undefined, initialData)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [errorMessage, setErrorMessage] = useState('')
  const organizationIdRef = useRef('')
  const snapshotRef = useRef<ChartData | null>(null)
  const syncingRef = useRef(false)

  const loadFromServer = useCallback(async () => {
    setLoadState('loading')
    setErrorMessage('')
    try {
      const organizationResponse = await organizationApi.getOrganization() as Parameters<typeof mapOrganizationResponseToChartState>[0]
      const hierarchyResponse = await hierarchyApi.getHierarchy() as Parameters<typeof mapHierarchyResponseToChartState>[0]
      const vesselResponse = await vesselsApi.getVessels() as Parameters<typeof mapVesselResponseListToChartVessels>[0]

      const organization = mapOrganizationResponseToChartState(organizationResponse)
      const hierarchy = mapHierarchyResponseToChartState(hierarchyResponse)
      const vessels = mapVesselResponseListToChartVessels(vesselResponse)

      organizationIdRef.current = (organizationResponse as { organization?: { id?: string } })?.organization?.id || ''
      const chartData: ChartData = {
        schemaVersion: 2,
        ...organization,
        ...hierarchy,
        vessels,
      }

      snapshotRef.current = chartData
      dispatch({ type: 'replace', data: chartData })
      setLoadState('ready')
      setSaveState('saved')
    } catch (error) {
      setLoadState('error')
      setSaveState('error')
      setErrorMessage(normalizeApiError(error, 'Failed to load chart data'))
    }
  }, [])

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
          crewDirector: workingCopy.crewDirector,
        },
        {
          title: snapshot.title,
          organizationName: snapshot.organizationName,
          effectiveDate: snapshot.effectiveDate,
          footerText: snapshot.footerText,
          crewDirector: snapshot.crewDirector,
        },
      )) {
        const response = await organizationApi.updateOrganization({
          name: workingCopy.organizationName,
          title: workingCopy.title,
          effectiveDate: toApiDateTime(workingCopy.effectiveDate),
          footerText: workingCopy.footerText || null,
          crewDirectorName: workingCopy.crewDirector.name,
          crewDirectorDesignation: workingCopy.crewDirector.designation,
          crewDirectorEmail: workingCopy.crewDirector.email || '',
          crewDirectorPhone: workingCopy.crewDirector.phone || '',
          crewDirectorNotes: workingCopy.crewDirector.notes || '',
        }) as { organization?: { id?: string } }
        organizationId = response.organization?.id || organizationId
        organizationIdRef.current = organizationId
      }

      const needsOrganization = workingCopy.operationsManagers.length > 0 || workingCopy.vessels.length > 0
      if (!organizationId) {
        if (needsOrganization) {
          throw new Error('Organization must be created before adding hierarchy or vessels.')
        }
        snapshotRef.current = workingCopy
        setSaveState('saved')
        await loadFromServer()
        return
      }

      const currentOps = workingCopy.operationsManagers
      const snapshotOps = new Map((snapshot?.operationsManagers || []).map((op) => [op.id, op]))
      for (const op of currentOps) {
        if (!snapshotOps.has(op.id)) {
          const created = await hierarchyApi.createOperationsManager({ organizationId, ...mapOperationsManagerToApiPayload(op) } as never) as { id?: string; person?: { id?: string } }
          op.id = created.id || op.id
          op.person.id = created.person?.id || op.person.id
        } else if (!equalJson({ person: op.person, sortOrder: op.sortOrder }, { person: snapshotOps.get(op.id)?.person, sortOrder: snapshotOps.get(op.id)?.sortOrder })) {
          await hierarchyApi.updateOperationsManager(op.id, mapOperationsManagerToApiPayload(op) as never)
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

      snapshotRef.current = workingCopy
      setSaveState('saved')
      await loadFromServer()
    } catch (error) {
      setSaveState('error')
      setErrorMessage(normalizeApiError(error, 'Failed to save changes'))
    }
  }, [loadFromServer])

  useEffect(() => {
    void loadFromServer()
  }, [loadFromServer])

  const hasUnsavedChanges = useMemo(() => !(snapshotRef.current && equalJson(snapshotRef.current, data)), [data])

  const saveChanges = useCallback(async () => {
    if (loadState !== 'ready' || syncingRef.current) return
    if (snapshotRef.current && equalJson(snapshotRef.current, data)) {
      setSaveState('saved')
      setErrorMessage('')
      return
    }
    syncingRef.current = true
    await syncToServer(data, snapshotRef.current)
    syncingRef.current = false
  }, [data, loadState, syncToServer])

  const value = useMemo(
    () => ({ data, dispatch, saveState, hasUnsavedChanges, loadState, errorMessage, saveChanges, reloadFromServer: loadFromServer }),
    [data, saveState, hasUnsavedChanges, loadState, errorMessage, saveChanges, loadFromServer],
  )

  return <ChartContext.Provider value={value}>{children}</ChartContext.Provider>
}

export function useChart() {
  const context = useContext(ChartContext)
  if (!context) throw new Error('useChart must be used within ChartProvider')
  return context
}
