import type { Role } from '@prisma/client'

export type SafeUser = {
  id: string
  name: string
  email: string
  role: Role
  isActive: boolean
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}
