import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(import.meta.dirname, '..')

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

describe('role-change relogin enforcement', () => {
  it('stores permissionVersion in the login session payload and checks it on requests', () => {
    const authRouteSource = read('server/src/routes/auth.ts')
    const authContextSource = read('server/src/auth/context.ts')

    expect(authRouteSource).toContain('pv: updated.permissionVersion')
    expect(authContextSource).toContain('if (user.permissionVersion !== payload.pv)')
    expect(authContextSource).toContain("code: roleChangedReloginCode")
  })

  it('increments permissionVersion when access or status changes', () => {
    const accessSource = read('server/src/routes/accessRequests.ts')

    expect(accessSource).toContain('permissionVersion: { increment: 1 }')
    expect(accessSource).toContain('permissionChanged ? { increment: 1 } : undefined')
  })

  it('forces the frontend back to login when the backend returns ROLE_CHANGED_RELOGIN_REQUIRED', () => {
    const clientSource = read('src/api/client.ts')
    const appSource = read('src/App.tsx')

    expect(clientSource).toContain("body.code === 'ROLE_CHANGED_RELOGIN_REQUIRED'")
    expect(clientSource).toContain("notifyAuthInvalidation(message)")
    expect(appSource).toContain("window.addEventListener('crew-auth-invalidated'")
    expect(appSource).toContain("setLoginNotice(detail?.message || 'Your session expired. Please sign in again.')")
  })
})
