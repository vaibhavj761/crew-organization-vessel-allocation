import { beforeAll, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

let setAuthCookie: typeof import('../server/src/utils/session').setAuthCookie
let getCurrentUser: typeof import('../server/src/auth/context').getCurrentUser

beforeAll(async () => {
  vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test')
  vi.stubEnv('SESSION_SECRET', 'test-session-secret-that-is-longer-than-thirty-two-characters')
  vi.stubEnv('FRONTEND_URL', 'http://localhost:5173')
  vi.stubEnv('NODE_ENV', 'test')
  ;({ setAuthCookie } = await import('../server/src/utils/session'))
  ;({ getCurrentUser } = await import('../server/src/auth/context'))
})

describe('production session security', () => {
  it('uses a bounded http-only session cookie instead of a seven-day login', () => {
    const setCookie = vi.fn()
    setAuthCookie({ setCookie } as never, 'signed-token')
    expect(setCookie).toHaveBeenCalledWith('crew_chart_session', 'signed-token', expect.objectContaining({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: expect.any(Number),
    }))
    const options = setCookie.mock.calls[0][2]
    expect(options.maxAge).toBeGreaterThan(0)
    expect(options.maxAge).toBeLessThanOrEqual(24 * 60 * 60)
  })

  it('rejects legacy seven-day sessions before any database lookup', async () => {
    const user = await getCurrentUser({
      cookies: { crew_chart_session: 'legacy-token' },
      jwtVerify: vi.fn().mockResolvedValue({ sub: 'user-1', pv: 0 }),
    } as never)
    expect(user).toBeNull()
  })

  it('allows browser-generated data and blob images under the production CSP', async () => {
    const { app } = await import('../server/src/index')
    const response = await app.inject({ method: 'GET', url: '/api/health' })
    const policy = response.headers['content-security-policy'] || ''
    expect(policy).toContain("img-src 'self' data: blob:")
    await app.close()
  })

  it('caches only hashed frontend assets for faster repeat loads', () => {
    const source = readFileSync(resolve('server/src/index.ts'), 'utf8')
    expect(source).toContain("pathname.startsWith('/assets/')")
    expect(source).toContain("'public, max-age=31536000, immutable'")
    expect(source).toContain("'no-cache'")
  })
})
