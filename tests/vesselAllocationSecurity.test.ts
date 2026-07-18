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
})
