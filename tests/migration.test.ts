import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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
    expect(parsed.operationsManagers[0].deputyManagers[0].crewManagers[0].vesselIds).toEqual(['v1-vessel'])
    expect(parsed.vessels[0].crewManagerId).toBe('v1-team')
  })
})

describe('role migration', () => {
  it('preserves legacy Boss Viewer users as Viewers before removing the enum value', () => {
    const migration = readFileSync(resolve('server/prisma/migrations/20260720120000_remove_boss_viewer_role/migration.sql'), 'utf8')
    expect(migration).toContain("SET \"role\" = 'VIEWER'")
    expect(migration).toContain("WHERE \"role\" = 'BOSS_VIEWER'")
    expect(migration).toContain("AS ENUM ('ADMIN', 'EDITOR', 'VIEWER')")
  })
})
