import type { SafeUser } from '../types'

type Role = SafeUser['role']

export function getDisplayRole(role: Role): 'ADMIN' | 'EDITOR' | 'VIEWER' {
  return role
}

export function getRoleLabel(role: Role) {
  return getDisplayRole(role).replaceAll('_', ' ')
}
