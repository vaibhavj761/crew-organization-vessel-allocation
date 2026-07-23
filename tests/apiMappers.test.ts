import { describe, expect, it } from 'vitest'
import { sampleData } from '../src/data/sampleData'
import {
  mapHierarchyResponseToChartState,
  mapVesselResponseToVessel,
  mapVesselToApiPayload,
} from '../src/state/apiMappers'

describe('api mappers', () => {
  it('maps operations managers with nested deputy and crew managers while preserving backend ids', () => {
    const mapped = mapHierarchyResponseToChartState({
      crewDirectors: [{
        id: 'director-9',
        person: { id: 'director-person-9', name: 'Asha', designation: 'Crew Director', email: 'asha@example.com' },
        operationsManagers: [{
          id: 'ops-1',
          person: { id: 'person-1', name: 'Marcus', designation: 'Crew Operations Manager', email: 'ops@example.com' },
          deputyManagers: [{
            id: 'deputy-node-1',
            person: { id: 'person-deputy-1', name: 'Pavan', designation: 'Deputy Crew Manager' },
            crewManagers: [{
              id: 'crew-node-1',
              person: { id: 'person-2', name: 'Leena', designation: 'Crew Manager', email: 'leena@example.com' },
              vessels: [{ id: 'vessel-a' }],
            }],
          }],
        }],
      }],
    })

    const deputy = mapped.operationsManagers[0].deputyManagers[0]
    expect(mapped.crewDirectors[0].id).toBe('director-9')
    expect(mapped.operationsManagers[0].id).toBe('ops-1')
    expect(mapped.operationsManagers[0].crewDirectorId).toBe('director-9')
    expect(deputy.id).toBe('deputy-node-1')
    expect(deputy.crewManagers[0].id).toBe('crew-node-1')
    expect(deputy.crewManagers[0].person.id).toBe('person-2')
    expect(deputy.crewManagers[0].vesselIds).toEqual(['vessel-a'])
  })

  it('wraps legacy operations-manager crew managers under a default deputy manager', () => {
    const mapped = mapHierarchyResponseToChartState({
      crewDirectors: [{
        id: 'director-1',
        person: { name: 'Director' },
        operationsManagers: [{
          id: 'ops-node-1',
          person: { id: 'person-ops-1', name: 'Ops', designation: 'Crew Operations Manager' },
          crewManagers: [{
            id: 'crew-node-99',
            person: { id: 'person-cm-7', name: 'Crew', designation: 'Crew Manager' },
            vessels: [],
          }],
        }],
      }],
    })

    expect(mapped.operationsManagers[0].deputyManagers[0].person.workflowRole).toBe('DEPUTY_MANAGER')
    expect(mapped.operationsManagers[0].deputyManagers[0].crewManagers[0].id).toBe('crew-node-99')
    expect(mapped.operationsManagers[0].deputyManagers[0].crewManagers[0].person.id).toBe('person-cm-7')
  })

  it('preserves each shared manager placement and keeps its descendants placement-specific', () => {
    const primaryPlacement = {
      id: 'ops-shared',
      reportingLineId: 'ops-line-primary',
      isPrimaryReportingLine: true,
      crewDirectorId: 'director-one',
      crewDirectorIds: ['director-one', 'director-two'],
      person: { id: 'person-shared', name: 'Shared Ops', designation: 'Crew Operations Manager' },
      deputyManagers: [{
        id: 'deputy-shared',
        reportingLineId: 'deputy-line-primary',
        isPrimaryReportingLine: true,
        operationsManagerId: 'ops-shared',
        person: { id: 'person-deputy', name: 'Michael', designation: 'Deputy Manager' },
        crewManagers: [{
          id: 'crew-original',
          reportingLineId: 'crew-line-primary',
          isPrimaryReportingLine: true,
          deputyManagerId: 'deputy-shared',
          person: { id: 'person-crew', name: 'Original Crew Manager', designation: 'Crew Manager' },
          vessels: [{ id: 'vessel-only-on-primary' }],
        }],
      }],
    }
    const copiedPlacement = {
      ...primaryPlacement,
      reportingLineId: 'ops-line-secondary',
      isPrimaryReportingLine: false,
      crewDirectorId: 'director-two',
      deputyManagers: [{
        ...primaryPlacement.deputyManagers[0],
        reportingLineId: 'deputy-line-secondary',
        isPrimaryReportingLine: false,
        crewManagers: [],
      }],
    }
    const mapped = mapHierarchyResponseToChartState({
      crewDirectors: [
        { id: 'director-one', person: { name: 'Director One' }, operationsManagers: [primaryPlacement] },
        { id: 'director-two', person: { name: 'Director Two' }, operationsManagers: [copiedPlacement] },
      ],
    })

    expect(mapped.operationsManagers).toHaveLength(2)
    expect(mapped.operationsManagers[0].reportingLineId).toBe('ops-line-primary')
    expect(mapped.operationsManagers[1].reportingLineId).toBe('ops-line-secondary')
    expect(mapped.operationsManagers[0].crewDirectorIds).toEqual(['director-one', 'director-two'])
    expect(mapped.operationsManagers[0].deputyManagers[0].crewManagers).toHaveLength(1)
    expect(mapped.operationsManagers[1].deputyManagers[0].crewManagers).toHaveLength(0)
    expect(mapped.operationsManagers[0].deputyManagers[0].crewManagers[0].vesselIds).toEqual(['vessel-only-on-primary'])
  })

  it('maps vessel allocations and clears legacy assistant metadata', () => {
    const vessel = mapVesselResponseToVessel({
      id: 'vessel-1',
      name: 'MV Northern Star',
      vesselStatus: 'IN_MANAGEMENT',
      managementType: 'FULL_MANAGED',
      currentAllocation: {
        crewManagerId: 'crew-node-1',
        crewManagerReportingLineId: 'crew-line-1',
        deputyManagerId: 'deputy-node-1',
        operationsManagerId: 'operations-node-1',
        assignedAssistantId: 'assistant-node-1',
      },
    }, 1)

    expect(vessel.crewManagerId).toBe('crew-node-1')
    expect(vessel.crewManagerReportingLineId).toBe('crew-line-1')
    expect(vessel.deputyManagerId).toBe('deputy-node-1')
    expect(vessel.operationsManagerId).toBe('operations-node-1')
    expect(vessel.assignedAssistantId).toBe('')
  })

  it('fills missing optional vessel fields safely', () => {
    const vessel = mapVesselResponseToVessel({ id: 'vessel-2', name: 'MV Ocean Crest' }, 2)
    expect(vessel.vesselType).toBe('')
    expect(vessel.ownerName).toBe('')
    expect(vessel.vesselStatus).toBe('IN_MANAGEMENT')
  })

  it('maps chart vessel data back to a stable api payload', () => {
    const payload = mapVesselToApiPayload(sampleData.vessels[0])
    expect(payload.name).toBe('MV Northern Star')
    expect(payload.vesselStatus).toBe('IN_MANAGEMENT')
    expect(payload.crewManagerId).toBe(sampleData.vessels[0].crewManagerId)
    expect(payload.crewManagerReportingLineId).toBe(sampleData.vessels[0].crewManagerReportingLineId)
  })
})
