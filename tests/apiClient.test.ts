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
})
