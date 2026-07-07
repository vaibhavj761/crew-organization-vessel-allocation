import type { User } from '@prisma/client'
import type { SafeUser } from '../types.js'

export function toSafeUser(user: User): SafeUser {
  const { passwordHash, permissionVersion, ...safe } = user
  void passwordHash
  void permissionVersion
  return safe
}
