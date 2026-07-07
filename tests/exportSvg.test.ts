import { describe, expect, it } from 'vitest'
import { sampleData } from '../src/data/sampleData'
import { generateExportSvg } from '../src/utils/exportSvg'

describe('SVG export', () => {
  it('exports full overview as a native 16:9 SVG', () => {
    const svg = generateExportSvg(sampleData, { kind: 'full' })
    expect(svg).toContain('viewBox="0 0 1600 900"')
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
    const crewManagerId = sampleData.operationsManagers[0].crewManagers[0].id
    const svg = generateExportSvg(sampleData, { kind: 'manager', crewManagerId })
    expect(svg).toContain('Leena Thomas')
    expect(svg).toContain('MV Northern Star')
    expect(svg).not.toContain('Vikram Menon')
  })

  it('summarizes dense vessel data intentionally', () => {
    const data = structuredClone(sampleData)
    const crewManager = data.operationsManagers[0].crewManagers[0]
    data.vessels = Array.from({ length: 50 }, (_, index) => ({
      ...data.vessels[0],
      id: `dense-${index}`,
      name: `Dense Vessel ${index}`,
      crewManagerId: crewManager.id,
      assignedAssistantId: '',
      sortOrder: index + 1,
    }))

    const svg = generateExportSvg(data, { kind: 'operations', operationsManagerId: data.operationsManagers[0].id })
    expect(svg).toContain('more vessels in detailed view')
    expect(svg).not.toContain('NaN')
  })
})
