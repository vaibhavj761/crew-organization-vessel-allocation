import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../src/api/client')>('../src/api/client')
  return actual
})

import { buildApiUrl } from '../src/api/client'

describe('api client url construction', () => {
  it('keeps same-origin api paths clean', () => {
    expect(buildApiUrl('/api/auth/login')).toMatch(/\/api\/auth\/login$/)
  })

  it('does not create double /api prefixes', () => {
    expect(buildApiUrl('/api/auth/login').includes('/api/api/')).toBe(false)
  })

  it('broadcasts auth invalidation for forced relogin responses', async () => {
    const listener = vi.fn()
    window.addEventListener('crew-auth-invalidated', listener as EventListener)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => 'application/json' },
      json: async () => ({ code: 'ROLE_CHANGED_RELOGIN_REQUIRED', message: 'Your access was updated. Please sign in again.' }),
    }))

    const { apiClient, ApiError } = await import('../src/api/client')
    await expect(apiClient.request('/api/hierarchy', { fresh: true })).rejects.toBeInstanceOf(ApiError)
    expect(listener).toHaveBeenCalledTimes(1)

    window.removeEventListener('crew-auth-invalidated', listener as EventListener)
    vi.unstubAllGlobals()
  })

  it('shows a useful local backend message when fetch cannot connect', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const { apiClient, baseUrl } = await import('../src/api/client')
    await expect(apiClient.request('/api/health', { fresh: true })).rejects.toMatchObject({
      status: 0,
      message: `Cannot reach backend API. Please confirm the backend is running at ${baseUrl}.`,
    })

    vi.unstubAllGlobals()
  })
})
