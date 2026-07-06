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
  mapCrewManagerToApiPayload,
  mapHierarchyResponseToChartState,
  mapOperationsManagerToApiPayload,
  mapOrganizationResponseToChartState,
  mapPersonToApiPayload,
  mapVesselResponseListToChartVessels,
  mapVesselToApiPayload,
} from './apiMappers'

type LoadState = 'loading' | 'ready' | 'error'
type SaveState = 'saved' | 'saving' | 'error'

interface ChartContextValue {
  data: ChartData
  dispatch: Dispatch<ChartAction>
  saveState: SaveState
  loadState: LoadState
  errorMessage: string
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
  const timerRef = useRef<number | null>(null)
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

      if (!snapshot || !equalJson(
        {
          title: current.title,
          organizationName: current.organizationName,
          effectiveDate: current.effectiveDate,
          footerText: current.footerText,
          crewDirector: current.crewDirector,
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
          name: current.organizationName,
          title: current.title,
          effectiveDate: toApiDateTime(current.effectiveDate),
          footerText: current.footerText || null,
          crewDirectorName: current.crewDirector.name,
          crewDirectorDesignation: current.crewDirector.designation,
          crewDirectorEmail: current.crewDirector.email || '',
          crewDirectorPhone: current.crewDirector.phone || '',
          crewDirectorNotes: current.crewDirector.notes || '',
        }) as { organization?: { id?: string } }
        organizationId = response.organization?.id || organizationId
        organizationIdRef.current = organizationId
      }

      const needsOrganization = current.operationsManagers.length > 0 || current.vessels.length > 0
      if (!organizationId) {
        if (needsOrganization) {
          throw new Error('Organization must be created before adding hierarchy or vessels.')
        }
        snapshotRef.current = current
        setSaveState('saved')
        await loadFromServer()
        return
      }

      const snapshotOps = new Map((snapshot?.operationsManagers || []).map((op) => [op.id, op]))
      const currentOps = new Map(current.operationsManagers.map((op) => [op.id, op]))

      for (const op of current.operationsManagers) {
        if (!snapshotOps.has(op.id)) {
          const created = await hierarchyApi.createOperationsManager({ organizationId, ...mapOperationsManagerToApiPayload(op) } as never)
          op.id = (created as { id?: string }).id || op.id
        } else if (!equalJson(op.person, snapshotOps.get(op.id)?.person)) {
          await hierarchyApi.updateOperationsManager(op.id, mapOperationsManagerToApiPayload(op) as never)
        }
      }
      for (const op of snapshot?.operationsManagers || []) {
        if (!currentOps.has(op.id)) await hierarchyApi.deleteOperationsManager(op.id)
      }

      for (const op of current.operationsManagers) {
        const snapOp = snapshotOps.get(op.id)
        const snapCrew = new Map((snapOp?.crewManagers || []).map((cm) => [cm.id, cm]))
        const currentCrew = new Map(op.crewManagers.map((cm) => [cm.id, cm]))

        for (const cm of op.crewManagers) {
          if (!snapCrew.has(cm.id)) {
            const created = await hierarchyApi.createCrewManager({ organizationId, operationsManagerId: op.id, ...mapCrewManagerToApiPayload(cm) } as never)
            cm.id = (created as { id?: string }).id || cm.id
          } else if (!equalJson(cm.person, snapCrew.get(cm.id)?.person)) {
            await hierarchyApi.updateCrewManager(cm.id, { ...mapCrewManagerToApiPayload(cm), operationsManagerId: op.id } as never)
          }
        }
        for (const cm of snapOp?.crewManagers || []) {
          if (!currentCrew.has(cm.id)) await hierarchyApi.deleteCrewManager(cm.id)
        }

        for (const cm of op.crewManagers) {
          const snapCm = snapCrew.get(cm.id)
          const snapAssistants = new Map((snapCm?.assistants || []).map((assistant) => [assistant.id, assistant]))
          const currentAssistants = new Map(cm.assistants.map((assistant) => [assistant.id, assistant]))
          for (const assistant of cm.assistants) {
            if (!snapAssistants.has(assistant.id)) {
              const created = await hierarchyApi.createAssistant({ organizationId, crewManagerId: cm.id, ...mapPersonToApiPayload(assistant) } as never)
              assistant.id = (created as { id?: string }).id || assistant.id
            } else if (!equalJson(assistant, snapAssistants.get(assistant.id))) {
              await hierarchyApi.updateAssistant(assistant.id, { crewManagerId: cm.id, ...mapPersonToApiPayload(assistant) } as never)
            }
          }
          for (const assistant of snapCm?.assistants || []) {
            if (!currentAssistants.has(assistant.id)) await hierarchyApi.deleteAssistant(assistant.id)
          }
        }
      }

      const snapshotVessels = new Map((snapshot?.vessels || []).map((vessel) => [vessel.id, vessel]))
      const currentVessels = new Map(current.vessels.map((vessel) => [vessel.id, vessel]))
      for (const vessel of current.vessels) {
        if (!snapshotVessels.has(vessel.id)) {
          const created = await vesselsApi.createVessel({ organizationId, ...mapVesselToApiPayload(vessel) } as never)
          vessel.id = (created as { id?: string }).id || vessel.id
        } else if (!equalJson(mapVesselToApiPayload(vessel), mapVesselToApiPayload(snapshotVessels.get(vessel.id)!))) {
          await vesselsApi.updateVessel(vessel.id, { organizationId, ...mapVesselToApiPayload(vessel) } as never)
        }

        const snap = snapshotVessels.get(vessel.id)!
        if (vessel.crewManagerId !== snap.crewManagerId || vessel.assignedAssistantId !== snap.assignedAssistantId) {
          await vesselsApi.updateVesselAllocation(vessel.id, { crewManagerId: vessel.crewManagerId, assignedAssistantId: vessel.assignedAssistantId || null })
        }
      }
      for (const vessel of snapshot?.vessels || []) {
        if (!currentVessels.has(vessel.id)) await vesselsApi.deleteVessel(vessel.id)
      }

      snapshotRef.current = current
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

  useEffect(() => {
    if (loadState !== 'ready') return
    if (syncingRef.current) return
    if (snapshotRef.current && equalJson(snapshotRef.current, data)) return
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      syncingRef.current = true
      void syncToServer(data, snapshotRef.current).finally(() => {
        syncingRef.current = false
      })
    }, 500)
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [data, loadState, syncToServer])

  const value = useMemo(
    () => ({ data, dispatch, saveState, loadState, errorMessage, reloadFromServer: loadFromServer }),
    [data, saveState, loadState, errorMessage, loadFromServer],
  )

  return <ChartContext.Provider value={value}>{children}</ChartContext.Provider>
}

export function useChart() {
  const context = useContext(ChartContext)
  if (!context) throw new Error('useChart must be used within ChartProvider')
  return context
}
