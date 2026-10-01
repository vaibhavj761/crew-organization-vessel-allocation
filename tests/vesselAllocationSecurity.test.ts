import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(import.meta.dirname, '..')
const source = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8')

describe('vessel allocation write security', () => {
  it('protects assignment and unassignment with the existing write-role guard', () => {
    const routes = source('server/src/routes/organization.ts')
    const allocationUpdate = routes.slice(routes.indexOf("app.patch('/api/vessels/:id/allocation'"), routes.indexOf("app.get('/api/reports/summary'"))
    expect(allocationUpdate).toContain('ensureAuthorizedWrite(request, reply)')
    expect(allocationUpdate).toContain("app.delete('/api/vessels/:id/allocation'")
    expect(allocationUpdate).toContain("action: 'vessel.allocation.remove'")
  })

  it('protects atomic bulk vessel moves and retains one allocation per vessel', () => {
    const routes = source('server/src/routes/organization.ts')
    const start = routes.indexOf("app.patch('/api/vessels/allocations/bulk'")
    const end = routes.indexOf("app.patch('/api/vessels/:id/allocation'", start)
    const bulkRoute = routes.slice(start, end)

    expect(start).toBeGreaterThan(-1)
    expect(bulkRoute).toContain('ensureAuthorizedWrite(request, reply)')
    expect(bulkRoute).toContain('prisma.$transaction')
    expect(bulkRoute).toContain('vesselAllocation.upsert')
    expect(bulkRoute).toContain('crewManagerReportingLineId: reportingLine.id')
  })

  it('does not return password hashes from admin user updates', () => {
    const routes = source('server/src/routes/accessRequests.ts')
    expect(routes).toContain('user: toSafeUser(updated)')
    expect(routes).not.toContain('user: updated })')
  })

  it('protects hierarchy move/copy operations and audits the result', () => {
    const routes = source('server/src/routes/organization.ts')
    const placement = routes.slice(routes.indexOf("app.post('/api/hierarchy/placements'"), routes.indexOf("app.post('/api/crew-directors'"))
    expect(placement).toContain('ensureAuthorizedWrite(request, reply)')
    expect(routes).toContain("action: z.enum(['MOVE', 'COPY'])")
    expect(placement).toContain("'hierarchy.reporting.copy'")
    expect(placement).toContain("'hierarchy.reporting.move'")
  })

  it('scopes copied hierarchy branches to exact placements and keeps vessels on one placement', () => {
    const hierarchy = source('server/src/services/hierarchy.ts')
    const routes = source('server/src/routes/organization.ts')
    expect(hierarchy).toContain('deputyLinesByOperationsPlacement.get(operationsLine.id)')
    expect(hierarchy).toContain('crewLinesByDeputyPlacement.get(deputyLine.id)')
    expect(hierarchy).toContain('vessels: vesselsByCrewManagerPlacement.get(crewLine.id)')
    expect(routes).toContain('crewManagerReportingLineId: reportingLine.id')
    expect(routes).toContain('operationsManagerReportingLineId: parentPlacement.id')
    expect(routes).toContain('deputyManagerReportingLineId: parentPlacement.id')
  })

  it('removes only an empty Crew Manager reporting line and retains the employee', () => {
    const routes = source('server/src/routes/organization.ts')
    const start = routes.indexOf("app.delete('/api/hierarchy/crew-manager-placements/:id'")
    const end = routes.indexOf("app.post('/api/crew-directors'", start)
    const removalRoute = routes.slice(start, end)

    expect(start).toBeGreaterThan(-1)
    expect(removalRoute).toContain('ensureAuthorizedWrite(request, reply)')
    expect(removalRoute).toContain('vesselAllocations')
    expect(removalRoute).toContain('crewManagerReportingLine.delete')
    expect(removalRoute).not.toContain('crewManager.delete')
    expect(removalRoute).not.toContain('person.delete')
    expect(removalRoute).toContain('employeeRetained: true')
  })

  it('blocks removal of Operations and Deputy placements that still have direct reports', () => {
    const routes = source('server/src/routes/organization.ts')
    const operationsStart = routes.indexOf("app.delete('/api/hierarchy/operations-manager-placements/:id'")
    const deputyStart = routes.indexOf("app.delete('/api/hierarchy/deputy-manager-placements/:id'")
    const crewStart = routes.indexOf("app.delete('/api/hierarchy/crew-manager-placements/:id'")
    const operationsRoute = routes.slice(operationsStart, deputyStart)
    const deputyRoute = routes.slice(deputyStart, crewStart)

    expect(operationsRoute).toContain('ensureAuthorizedWrite(request, reply)')
    expect(operationsRoute).toContain('deputyReportingLines.length')
    expect(deputyRoute).toContain('ensureAuthorizedWrite(request, reply)')
    expect(deputyRoute).toContain('crewReportingLines.length')
    expect(operationsRoute).not.toContain('operationsManager.delete')
    expect(deputyRoute).not.toContain('deputyManager.delete')
  })

  it('guards configurable hierarchy writes and prevents circular reporting lines', () => {
    const routes = source('server/src/routes/organization.ts')
    const start = routes.indexOf("app.post('/api/hierarchy/management-positions'")
    const end = routes.indexOf("app.post('/api/hierarchy/placements'", start)
    const configurableHierarchy = routes.slice(start, end)

    expect(start).toBeGreaterThan(-1)
    expect(configurableHierarchy.match(/ensureAuthorizedWrite\(request, reply\)/g)?.length).toBeGreaterThanOrEqual(5)
    expect(configurableHierarchy).toContain('This move would create a circular reporting line.')
    expect(configurableHierarchy).toContain('employeeRetained: true')
    expect(configurableHierarchy).toContain('Move this position’s direct reports before removing it')
  })
})
