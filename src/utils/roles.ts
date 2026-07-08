import type { SafeUser } from '../types'

type Role = SafeUser['role']

export function getDisplayRole(role: Role): 'ADMIN' | 'EDITOR' | 'VIEWER' {
  return role === 'BOSS_VIEWER' ? 'VIEWER' : role
}

export function getRoleLabel(role: Role) {
  return getDisplayRole(role).replaceAll('_', ' ')
}
