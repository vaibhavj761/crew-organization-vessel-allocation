import type { User } from '@prisma/client'
import type { SafeUser } from '../types.js'

export function toSafeUser(user: User): SafeUser {
  const { passwordHash, ...safe } = user
  void passwordHash
  return safe
}
