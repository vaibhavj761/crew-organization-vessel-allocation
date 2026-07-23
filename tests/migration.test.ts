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

describe('hierarchy reporting migration', () => {
  it('backfills primary reporting lines without duplicating employee or vessel records', () => {
    const migration = readFileSync(resolve('server/prisma/migrations/20260723120000_add_hierarchy_reporting_lines/migration.sql'), 'utf8')
    expect(migration).toContain('CREATE TABLE "CrewManagerReportingLine"')
    expect(migration).toContain('FROM "OperationsManager"')
    expect(migration).toContain('FROM "DeputyManager"')
    expect(migration).toContain('FROM "CrewManager"')
    expect(migration).not.toContain('INSERT INTO "Person"')
    expect(migration).not.toContain('INSERT INTO "Vessel"')
  })

  it('scopes child reporting lines to exact parent placements without touching employees or vessels', () => {
    const migration = readFileSync(resolve('server/prisma/migrations/20260723150000_scope_reporting_children_to_parent_placements/migration.sql'), 'utf8')
    expect(migration).toContain('"operationsManagerReportingLineId"')
    expect(migration).toContain('"deputyManagerReportingLineId"')
    expect(migration).toContain('ORDER BY operations_line."isPrimary" DESC')
    expect(migration).toContain('ORDER BY deputy_line."isPrimary" DESC')
    expect(migration).not.toContain('INSERT INTO "Person"')
    expect(migration).not.toContain('INSERT INTO "Vessel"')
    expect(migration).not.toContain('DELETE FROM "Person"')
    expect(migration).not.toContain('DELETE FROM "Vessel"')
  })

  it('backfills vessel placement paths without deleting vessel or allocation data', () => {
    const migration = readFileSync(resolve('server/prisma/migrations/20260723170000_scope_vessel_allocations_to_reporting_placements/migration.sql'), 'utf8')
    expect(migration).toContain('ADD COLUMN "crewManagerReportingLineId"')
    expect(migration).toContain('WHERE reporting_line."crewManagerId" = allocation."crewManagerId"')
    expect(migration).toContain('ORDER BY reporting_line."isPrimary" DESC')
    expect(migration).toContain('ON DELETE RESTRICT')
    expect(migration).not.toContain('DELETE FROM "Vessel"')
    expect(migration).not.toContain('DELETE FROM "VesselAllocation"')
  })
})
