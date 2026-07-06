import { describe, expect, it } from 'vitest'
import { generateRawToken, hashToken } from '../server/src/utils/token'

describe('token utils', () => {
  it('generates tokens and hashes them deterministically', () => {
    const token = generateRawToken()
    expect(token.length).toBeGreaterThan(20)
    expect(hashToken(token)).toBe(hashToken(token))
  })
})
