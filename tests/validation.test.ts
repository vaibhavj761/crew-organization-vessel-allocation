import { describe, expect, it } from 'vitest'
import { sampleData } from '../src/data/sampleData'
import { chartDataSchema } from '../src/utils/validation'

describe('V3 validation', () => {
  it('accepts sample data', () => {
    expect(chartDataSchema.safeParse(sampleData).success).toBe(true)
  })

  it('rejects vessels assigned to removed crew managers', () => {
    const data = structuredClone(sampleData)
    data.operationsManagers[0].deputyManagers = []
    const result = chartDataSchema.safeParse(data)
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((issue) => issue.message === 'Crew Manager not found')).toBe(true)
  })

  it('separates designation and workflow role', () => {
    const data = structuredClone(sampleData)
    data.operationsManagers[0].deputyManagers[0].crewManagers[0].person.designation = 'Fleet Personnel Officer'
    expect(chartDataSchema.parse(data).operationsManagers[0].deputyManagers[0].crewManagers[0].person.workflowRole).toBe('CREW_MANAGER')
  })
})
