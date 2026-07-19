import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const authRoutes = readFileSync(resolve('server/src/routes/auth.ts'), 'utf8')
const accessRoutes = readFileSync(resolve('server/src/routes/accessRequests.ts'), 'utf8')
const tokenService = readFileSync(resolve('server/src/services/passwordTokens.ts'), 'utf8')

describe('password and account lifecycle security invariants', () => {
  it('only completes setup for an account still awaiting password setup', () => {
    expect(authRoutes).toContain("status: 'APPROVED_NEEDS_PASSWORD', isActive: true")
    expect(authRoutes).toContain("where: { id: token.record.id, usedAt: null, expiresAt: { gt: new Date() } }")
  })

  it('revokes authenticated sessions when a password reset completes', () => {
    const resetSection = authRoutes.slice(authRoutes.indexOf("app.post('/api/auth/reset-password'"))
    expect(resetSection).toContain("data: { passwordHash, permissionVersion: { increment: 1 } }")
  })

  it('supersedes older unused password tokens on every new issuance', () => {
    expect(tokenService).toContain('FOR UPDATE')
    expect(tokenService).toContain("where: { userId, type, usedAt: null }")
    expect(tokenService).toContain('return tx.passwordToken.create')
  })

  it('revokes outstanding password tokens when access is rejected or disabled', () => {
    expect(accessRoutes).toContain("status: 'REJECTED'")
    expect(accessRoutes).toContain("where: { userId: user.id, usedAt: null }")
    expect(accessRoutes).toContain("nextStatus === 'DISABLED' || nextStatus === 'REJECTED'")
  })

  it('allows only admins to provision users through one-time password setup', () => {
    const createSection = accessRoutes.slice(accessRoutes.indexOf("app.post('/api/admin/users'"), accessRoutes.indexOf("app.get('/api/admin/access-requests'"))
    expect(createSection).toContain('requireAdmin(request, reply)')
    expect(createSection).toContain("status: 'APPROVED_NEEDS_PASSWORD'")
    expect(createSection).toContain("createPasswordToken(created.id, 'SET_PASSWORD')")
    expect(createSection).toContain('user: toSafeUser(created)')
    expect(accessRoutes).not.toContain("app.post('/api/access-requests'")
  })
})
