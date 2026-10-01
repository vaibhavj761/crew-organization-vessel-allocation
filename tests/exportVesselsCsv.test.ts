import { describe, expect, it } from 'vitest'
import { sampleData } from '../src/data/sampleData'
import { buildVesselMasterCsv } from '../src/utils/exportVesselsCsv'

describe('Vessel Master Excel-compatible export', () => {
  it('includes the complete management reporting path for filtered vessel rows', () => {
    const data = structuredClone(sampleData)
    data.crewDirectors[0].managementPositions = [{
      id: 'head-cm', crewDirectorId: data.crewDirectors[0].id, parentPositionId: '', levelId: 'head-level', levelName: 'Head of CM, Asia', sortOrder: 1,
      person: { id: 'sudheer', name: 'Sudheer Chikala', designation: 'Head of CM, Asia', workflowRole: 'HIERARCHY_MANAGER', email: '', phone: '', notes: '' },
    }]
    data.operationsManagers[0].managementHierarchyPositionId = 'head-cm'

    const csv = buildVesselMasterCsv(data, [data.vessels[0]])

    expect(csv).toContain('"MV Northern Star"')
    expect(csv).toContain('"Sudheer Chikala (Head of CM, Asia)"')
    expect(csv).toContain('"Marcus Pereira"')
    expect(csv).toContain('"Pavan Kesari"')
    expect(csv).toContain('"Leena Thomas"')
  })

  it('prevents spreadsheet formula execution in user-entered cells', () => {
    const data = structuredClone(sampleData)
    data.vessels[0].name = '=HYPERLINK("https://unsafe.example")'
    expect(buildVesselMasterCsv(data, [data.vessels[0]])).toContain("'=HYPERLINK")
  })
})
