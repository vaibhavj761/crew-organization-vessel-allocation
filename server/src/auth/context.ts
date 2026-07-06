import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Role, User } from '@prisma/client'
import { prisma } from '../db/prisma.js'
import { toSafeUser } from '../utils/safeUser.js'

export const authCookieName = 'crew_chart_session'

export async function getCurrentUser(request: FastifyRequest) {
  const req = request as FastifyRequest & {
    cookies: Record<string, string | undefined>
    jwtVerify: <T>() => Promise<T>
  }
  const token = req.cookies[authCookieName]
  if (!token) return null
  try {
    const payload = await req.jwtVerify<{ sub: string }>()
    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user || !user.isActive) return null
    return toSafeUser(user)
  } catch {
    return null
  }
}

export async function requireCurrentUser(request: FastifyRequest, reply: FastifyReply) {
  const user = await getCurrentUser(request)
  if (!user) {
    reply.code(401).send({ message: 'Not authenticated' })
    return null
  }
  return user
}

export function canWrite(role: Role) {
  return role === 'ADMIN' || role === 'EDITOR'
}

export function canAdmin(role: Role) {
  return role === 'ADMIN'
}

export function requireWriteRole(user: User | Awaited<ReturnType<typeof getCurrentUser>>) {
  return user && 'role' in user && canWrite(user.role)
}
