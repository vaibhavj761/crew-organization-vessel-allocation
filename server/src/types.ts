import type { Role, UserStatus } from '@prisma/client'

export type SafeUser = {
  id: string
  name: string
  email: string
  role: Role
  status: UserStatus
  isActive: boolean
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}
