import { describe, expect, it } from 'vitest'
import { sampleData } from '../src/data/sampleData'
import { generateExportSvg } from '../src/utils/exportSvg'

describe('SVG export', () => {
  it('fits the complete hierarchy and every vessel name on one 16:9 slide', () => {
    const data = structuredClone(sampleData)
    data.crewDirectors[0].managementPositions = [{
      id: 'head-cm', crewDirectorId: data.crewDirectors[0].id, parentPositionId: '', levelId: 'head-cm-level', levelName: 'Head of CM, Asia', sortOrder: 1,
      person: { id: 'head-cm-person', name: 'Sudheer Chikala', designation: 'Head of CM, Asia', workflowRole: 'HIERARCHY_MANAGER', email: '', phone: '', notes: '' },
    }]
    data.operationsManagers[0].managementHierarchyPositionId = 'head-cm'
    const managers = Array.from({ length: 15 }, (_, index) => ({
      ...structuredClone(data.operationsManagers[index % 2].deputyManagers[0].crewManagers[0]),
      id: `complete-manager-${index}`,
      reportingLineId: `complete-line-${index}`,
      person: { ...structuredClone(data.operationsManagers[index % 2].deputyManagers[0].crewManagers[0].person), id: `complete-person-${index}`, name: `Complete Crew Manager ${index + 1}` },
      vesselIds: [],
    }))
    data.operationsManagers[0].deputyManagers[0].crewManagers = managers.slice(0, 8)
    data.operationsManagers[1].deputyManagers[0].crewManagers = managers.slice(8)
    data.vessels = Array.from({ length: 150 }, (_, index) => {
      const manager = managers[index % managers.length]
      const operationsManager = index % managers.length < 8 ? data.operationsManagers[0] : data.operationsManagers[1]
      const deputy = operationsManager.deputyManagers[0]
      return {
        ...structuredClone(sampleData.vessels[0]),
        id: `complete-vessel-${index}`,
        name: `Complete Vessel Name ${index + 1}`,
        crewManagerId: manager.id,
        crewManagerReportingLineId: manager.reportingLineId,
        deputyManagerId: deputy.id,
        operationsManagerId: operationsManager.id,
        sortOrder: index + 1,
      }
    })

    const svg = generateExportSvg(data, { kind: 'complete' })

    expect(svg).toContain('viewBox="0 0 1920 1080"')
    expect(svg).toContain('data-export-root="complete-one-page"')
    expect(svg).toContain('Sudheer Chikala')
    expect(svg).toContain('Consolidated Vessel Allocation')
    expect(svg).toContain('#11675f')
    expect(svg).toContain('#51358c')
    expect(svg).toContain('DEPUTY ·')
    managers.forEach((manager) => expect(svg).toContain(manager.person.name))
    data.vessels.forEach((vessel) => expect(svg).toContain(vessel.name))
    expect(svg).not.toContain('more vessels')
    expect(svg).not.toContain('NaN')
  })

  it('includes configurable management layers in the organization export', () => {
    const data = structuredClone(sampleData)
    data.crewDirectors[0].managementPositions = [{
      id: 'position-1', crewDirectorId: data.crewDirectors[0].id, parentPositionId: '', levelId: 'level-1', levelName: 'Head of Crew Management', sortOrder: 1,
      person: { id: 'person-head', name: 'Executive Head', designation: 'Head of Crew Management', workflowRole: 'HIERARCHY_MANAGER', email: '', phone: '', notes: '' },
    }]
    data.operationsManagers[0].managementHierarchyPositionId = 'position-1'
    const svg = generateExportSvg(data, { kind: 'full' })
    expect(svg).toContain('HEAD OF CREW MANAGEMENT')
    expect(svg).toContain('Executive Head')
    const allocationSvg = generateExportSvg(data, { kind: 'operations', operationsManagerId: data.operationsManagers[0].id })
    expect(allocationSvg).toContain('HEAD OF CREW MANAGEMENT')
    expect(allocationSvg).toContain('Executive Head')
  })

  it('exports full overview as a native 16:9 SVG', () => {
    const svg = generateExportSvg(sampleData, { kind: 'full' })
    expect(svg).toContain('viewBox="0 0 1920 1080"')
    expect(svg).toContain('data-export-root="complete-chart"')
    expect(svg).not.toContain('foreignObject')
    expect(svg).not.toContain('Delete')
  })

  it('exports a selected operations manager team only', () => {
    const svg = generateExportSvg(sampleData, { kind: 'operations', operationsManagerId: sampleData.operationsManagers[1].id })
    expect(svg).toContain('Priya Nair')
    expect(svg).toContain('Elena George')
    expect(svg).not.toContain('Leena Thomas')
  })

  it('exports a selected crew manager allocation focus', () => {
    const crewManagerId = sampleData.operationsManagers[0].deputyManagers[0].crewManagers[0].id
    const svg = generateExportSvg(sampleData, { kind: 'manager', crewManagerId })
    expect(svg).toContain('Leena Thomas')
    expect(svg).toContain('MV Northern Star')
    expect(svg).not.toContain('Vikram Menon')
  })

  it('includes every vessel in adaptive presentation mode without viewport clipping', () => {
    const data = structuredClone(sampleData)
    const crewManager = data.operationsManagers[0].deputyManagers[0].crewManagers[0]
    data.vessels = Array.from({ length: 50 }, (_, index) => ({
      ...data.vessels[0],
      id: `dense-${index}`,
      name: `Dense Vessel ${index}`,
      crewManagerId: crewManager.id,
      assignedAssistantId: '',
      sortOrder: index + 1,
    }))

    const svg = generateExportSvg(data, { kind: 'operations', operationsManagerId: data.operationsManagers[0].id })
    expect(svg).toContain('data-density="balanced"')
    expect(svg).toContain('Dense Vessel 0')
    expect(svg).toContain('Dense Vessel 49')
    expect(svg).not.toContain('more vessels')
    expect(svg).not.toContain('NaN')
  })

  it('keeps a three-manager team visible in export output', () => {
    const data = structuredClone(sampleData)
    const directorId = data.crewDirectors[0].id
    data.operationsManagers[0].deputyManagers[0].crewManagers.push({
      id: 'team-manager-3',
      sortOrder: 3,
      person: { id: 'manager-4', name: 'Sidharth Bajaj', designation: 'Crew Manager', workflowRole: 'CREW_MANAGER', email: '', phone: '', notes: '' },
      vesselIds: [],
    })
    data.vessels.push({
      ...data.vessels[0],
      id: 'vessel-extra-1',
      name: 'MV Third Team Vessel',
      crewManagerId: 'team-manager-3',
      assignedAssistantId: '',
      sortOrder: 99,
    })

    const svg = generateExportSvg(data, { kind: 'director', directorId })
    expect(svg).toContain('Leena Thomas')
    expect(svg).toContain('Vikram Menon')
    expect(svg).toContain('Sidharth Bajaj')
  })

  it('wraps long identity content safely inside a complete export root', () => {
    const data = structuredClone(sampleData)
    data.operationsManagers[0].person.name = 'A Very Long Crew Operations Manager Name Used For Export Safety Testing '.repeat(3).trim()
    const svg = generateExportSvg(data, { kind: 'full' })
    expect(svg).toContain('A Very Long Crew Operations Manager')
    expect(svg).toContain('…')
    expect(svg).toContain('data-export-root="complete-chart"')
    expect(svg).not.toContain('overflow="hidden"')
  })
})
