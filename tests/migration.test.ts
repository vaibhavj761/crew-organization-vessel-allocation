import { describe, expect, it } from 'vitest'
import { migrateChartData } from '../src/utils/migration'
import { chartDataSchema } from '../src/utils/validation'
import legacy from './v1Fixture.json'

describe('V1 migration', () => {
  it('preserves hierarchy and moves vessels to master list', () => {
    const result = migrateChartData(legacy)
    const parsed = chartDataSchema.parse(result)
    expect(parsed.schemaVersion).toBe(2)
    expect(parsed.crewDirectors).toHaveLength(1)
    expect(parsed.crewDirectors[0].person.workflowRole).toBe('CREW_DIRECTOR')
    expect(parsed.operationsManagers).toHaveLength(1)
    expect(parsed.operationsManagers[0].crewDirectorId).toBe(parsed.crewDirectors[0].id)
    expect(parsed.operationsManagers[0].crewManagers[0].vesselIds).toEqual(['v1-vessel'])
    expect(parsed.vessels[0].crewManagerId).toBe('v1-manager')
  })
})
