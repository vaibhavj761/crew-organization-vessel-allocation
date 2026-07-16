import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Role, User } from '@prisma/client'
import { prisma } from '../db/prisma.js'
import { toSafeUser } from '../utils/safeUser.js'
import { authSessionVersion } from '../utils/session.js'

export const authCookieName = 'crew_chart_session'
export const roleChangedReloginCode = 'ROLE_CHANGED_RELOGIN_REQUIRED'

type SessionPayload = {
  sub: string
  pv: number
  sv: number
}

type SessionResolveResult =
  | { user: Awaited<ReturnType<typeof toSafeUser>>; reason: null }
  | { user: null; reason: 'NOT_AUTHENTICATED' | typeof roleChangedReloginCode }

async function verifySession(request: FastifyRequest): Promise<SessionResolveResult> {
  const req = request as FastifyRequest & {
    cookies: Record<string, string | undefined>
    jwtVerify: <T>() => Promise<T>
  }
  const token = req.cookies[authCookieName]
  if (!token) return { user: null, reason: 'NOT_AUTHENTICATED' }

  try {
    const payload = await req.jwtVerify<SessionPayload>()
    if (payload.sv !== authSessionVersion) return { user: null, reason: 'NOT_AUTHENTICATED' }
    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user) return { user: null, reason: 'NOT_AUTHENTICATED' }
    if (user.permissionVersion !== payload.pv) return { user: null, reason: roleChangedReloginCode }
    if (!user.isActive || user.status !== 'ACTIVE') return { user: null, reason: roleChangedReloginCode }
    return { user: toSafeUser(user), reason: null }
  } catch {
    return { user: null, reason: 'NOT_AUTHENTICATED' }
  }
}

export async function getCurrentUser(request: FastifyRequest) {
  const result = await verifySession(request)
  return result.user
}

export async function getCurrentUserWithReason(request: FastifyRequest) {
  return verifySession(request)
}

export async function requireCurrentUser(request: FastifyRequest, reply: FastifyReply) {
  const result = await verifySession(request)
  if (!result.user) {
    if (result.reason === roleChangedReloginCode) {
      reply.code(401).send({ code: roleChangedReloginCode, message: 'Your access was updated. Please sign in again.' })
      return null
    }
    reply.code(401).send({ message: 'Not authenticated' })
    return null
  }
  return result.user
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
