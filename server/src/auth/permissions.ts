import type { Role } from '@prisma/client'

export function hasAtLeastRole(role: Role, allowed: Role[]) {
  return allowed.includes(role)
}
