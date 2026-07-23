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
    expect(hierarchy).toContain('line.operationsManagerReportingLineId === operationsLine.id')
    expect(hierarchy).toContain('line.deputyManagerReportingLineId === deputyLine.id')
    expect(hierarchy).toContain('vessels: vesselsByCrewManagerPlacement.get(crewLine.id)')
    expect(routes).toContain('crewManagerReportingLineId: reportingLine.id')
    expect(routes).toContain('operationsManagerReportingLineId: parentPlacement.id')
    expect(routes).toContain('deputyManagerReportingLineId: parentPlacement.id')
  })
})
