import { describe, expect, it } from 'vitest'
import { sampleData } from '../src/data/sampleData'
import { chartReducer } from '../src/state/chartReducer'
import type { CrewManagerNode } from '../src/types'

describe('V3 hierarchy reducer', () => {
  it('moves a crew manager between deputy managers', () => {
    const state = structuredClone(sampleData)
    const fromDeputy = state.operationsManagers[0].deputyManagers[0]
    const toDeputy = state.operationsManagers[1].deputyManagers[0]
    const crewManager = fromDeputy.crewManagers[0]

    const next = chartReducer(state, {
      type: 'moveCrewManager',
      fromDeputyManagerId: fromDeputy.id,
      toDeputyManagerId: toDeputy.id,
      id: crewManager.id,
    })

    expect(next.operationsManagers[0].deputyManagers[0].crewManagers.some((item) => item.id === crewManager.id)).toBe(false)
    expect(next.operationsManagers[1].deputyManagers[0].crewManagers.some((item) => item.id === crewManager.id)).toBe(true)
  })

  it('adds a crew manager only under the selected deputy manager', () => {
    const state = structuredClone(sampleData)
    const target = state.operationsManagers[1].deputyManagers[0]
    const other = state.operationsManagers[0].deputyManagers[0]
    const crewManager: CrewManagerNode = {
      id: 'qa-new-cm',
      sortOrder: target.crewManagers.length + 1,
      person: { id: 'qa-new-cm-person', name: 'QA Added Crew Manager', designation: 'Crew Manager', workflowRole: 'CREW_MANAGER', email: '', phone: '', notes: '' },
      vesselIds: [],
    }

    const next = chartReducer(state, { type: 'addCrewManager', deputyManagerId: target.id, value: crewManager })

    expect(next.operationsManagers[1].deputyManagers[0].crewManagers.some((item) => item.id === crewManager.id)).toBe(true)
    expect(next.operationsManagers[0].deputyManagers[0].crewManagers.some((item) => item.id === crewManager.id)).toBe(false)
    expect(other.crewManagers.some((item) => item.id === crewManager.id)).toBe(false)
  })

  it('clears legacy assistant assignment metadata on vessel update', () => {
    const state = structuredClone(sampleData)
    const vessel = { ...state.vessels[0], crewManagerId: 'team-manager-3', assignedAssistantId: 'assistant-1' }
    const next = chartReducer(state, { type: 'updateVessel', value: vessel })
    expect(next.vessels[0].assignedAssistantId).toBe('')
  })

  it('syncs crew manager vessel IDs when reassigned', () => {
    const state = structuredClone(sampleData)
    const vessel = { ...state.vessels[0], crewManagerId: 'team-manager-3', assignedAssistantId: '' }
    const next = chartReducer(state, { type: 'updateVessel', value: vessel })
    expect(next.operationsManagers[0].deputyManagers[0].crewManagers[0].vesselIds).not.toContain(vessel.id)
    expect(next.operationsManagers[1].deputyManagers[0].crewManagers[0].vesselIds).toContain(vessel.id)
  })
})
