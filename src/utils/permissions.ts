import type { SafeUser } from '../types'

export function canEditChart(user: SafeUser | null) {
  return user?.role === 'ADMIN' || user?.role === 'EDITOR'
}

export function canEditVessels(user: SafeUser | null) {
  return canEditChart(user)
}

export function canManageAccess(user: SafeUser | null) {
  return user?.role === 'ADMIN'
}

export function canExport(user: SafeUser | null) {
  return Boolean(user)
}

export function isReadOnly(user: SafeUser | null) {
  return !!user && !canEditChart(user)
}
