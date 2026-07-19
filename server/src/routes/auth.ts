import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { authSessionVersion, clearAuthCookie, setAuthCookie } from '../utils/session.js'
import { toSafeUser } from '../utils/safeUser.js'
import { consumePasswordToken, createPasswordToken } from '../services/passwordTokens.js'
import { requestIp, writeAuditLog } from '../services/audit.js'
import { getCurrentUserWithReason, requireCurrentUser, roleChangedReloginCode } from '../auth/context.js'
import { env } from '../config/env.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const passwordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
})

const forgotSchema = z.object({
  email: z.string().email(),
})

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  currentPassword: z.string().min(1, 'Current password is required.'),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.'),
}).refine((value) => value.currentPassword !== value.newPassword, { path: ['newPassword'], message: 'Choose a new password that is different from your current password.' })

async function issueSession(reply: Parameters<typeof setAuthCookie>[0], user: { id: string; permissionVersion: number }) {
  const token = await reply.jwtSign(
    { sub: user.id, pv: user.permissionVersion, sv: authSessionVersion },
    { sign: { expiresIn: env.SESSION_TTL_HOURS * 60 * 60 } },
  )
  setAuthCookie(reply, token)
}

function loginStatusMessage(status: string) {
  if (status === 'PENDING_APPROVAL') return 'Your access request is still pending approval.'
  if (status === 'APPROVED_NEEDS_PASSWORD') return 'Your account has been approved. Please set your password before logging in.'
  if (status === 'REJECTED') return 'Your access request was rejected.'
  if (status === 'DISABLED') return 'Your account is disabled.'
  return 'Invalid email or password'
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ message: 'Invalid login payload' })

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase().trim() } })
    if (!user || !user.isActive) return reply.code(401).send({ message: 'Invalid email or password' })
    if (user.status !== 'ACTIVE') return reply.code(403).send({ message: loginStatusMessage(user.status) })
    if (!user.passwordHash) return reply.code(403).send({ message: 'Password setup required.' })

    const ok = await verifyPassword(parsed.data.password, user.passwordHash)
    if (!ok) return reply.code(401).send({ message: 'Invalid email or password' })

    const updated = await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    await issueSession(reply, updated)
    return reply.send({ user: toSafeUser(updated) })
  })

  app.post('/api/auth/logout', { config: { rateLimit: { max: 40, timeWindow: '1 minute' } } }, async (_request, reply) => {
    clearAuthCookie(reply)
    return reply.send({ success: true })
  })

  app.get('/api/auth/me', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (request, reply) => {
    const result = await getCurrentUserWithReason(request)
    if (!result.user) {
      if (result.reason === roleChangedReloginCode) {
        return reply.code(401).send({ code: roleChangedReloginCode, message: 'Your access was updated. Please sign in again.' })
      }
      return reply.code(401).send({ message: 'Not authenticated' })
    }
    const user = await prisma.user.findUnique({ where: { id: result.user.id } })
    if (!user) return reply.code(401).send({ message: 'Not authenticated' })
    return reply.send({ user: toSafeUser(user) })
  })

  app.patch('/api/auth/profile', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const currentUser = await requireCurrentUser(request, reply)
    if (!currentUser) return
    const parsed = profileSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ message: parsed.error.issues[0]?.message || 'Invalid profile payload' })
    const user = await prisma.user.findUnique({ where: { id: currentUser.id } })
    if (!user?.passwordHash || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
      return reply.code(400).send({ message: 'Current password is incorrect.' })
    }
    const duplicate = await prisma.user.findFirst({ where: { email: parsed.data.email, id: { not: user.id } }, select: { id: true } })
    if (duplicate) return reply.code(409).send({ message: 'That email address is already in use.' })
    const emailChanged = parsed.data.email !== user.email
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        permissionVersion: emailChanged ? { increment: 1 } : undefined,
      },
    })
    if (emailChanged) await issueSession(reply, updated)
    await writeAuditLog({
      userId: user.id,
      action: 'user.profile.updated',
      entityType: 'User',
      entityId: user.id,
      beforeJson: { name: user.name, email: user.email },
      afterJson: { name: updated.name, email: updated.email },
      ipAddress: requestIp(request),
    })
    return reply.send({ user: toSafeUser(updated) })
  })

  app.post('/api/auth/change-password', { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } }, async (request, reply) => {
    const currentUser = await requireCurrentUser(request, reply)
    if (!currentUser) return
    const parsed = changePasswordSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ message: parsed.error.issues[0]?.message || 'Invalid password payload' })
    const user = await prisma.user.findUnique({ where: { id: currentUser.id } })
    if (!user?.passwordHash || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
      return reply.code(400).send({ message: 'Current password is incorrect.' })
    }
    const passwordHash = await hashPassword(parsed.data.newPassword)
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, permissionVersion: { increment: 1 } },
    })
    await issueSession(reply, updated)
    await writeAuditLog({ userId: user.id, action: 'password.changed', entityType: 'User', entityId: user.id, ipAddress: requestIp(request) })
    return reply.send({ success: true })
  })

  app.post('/api/auth/set-password', { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parsed = passwordSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ message: 'Invalid password payload' })

    const token = await consumePasswordToken(parsed.data.token, 'SET_PASSWORD')
    if (!token.ok) return reply.code(400).send({ message: 'This password setup link is invalid or expired.' })

    const passwordHash = await hashPassword(parsed.data.newPassword)
    const completed = await prisma.$transaction(async (tx) => {
      const eligibleUser = await tx.user.findFirst({
        where: { id: token.record.userId, status: 'APPROVED_NEEDS_PASSWORD', isActive: true },
        select: { id: true },
      })
      if (!eligibleUser) return false
      const consumed = await tx.passwordToken.updateMany({
        where: { id: token.record.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      })
      if (consumed.count !== 1) return false
      await tx.user.update({
        where: { id: eligibleUser.id },
        data: { passwordHash, status: 'ACTIVE', isActive: true, permissionVersion: { increment: 1 } },
      })
      await tx.passwordToken.updateMany({
        where: { userId: eligibleUser.id, type: 'SET_PASSWORD', usedAt: null },
        data: { usedAt: new Date() },
      })
      return true
    })
    if (!completed) return reply.code(400).send({ message: 'This password setup link is invalid or expired.' })

    await writeAuditLog({
      userId: token.record.userId,
      action: 'password.setup.completed',
      entityType: 'User',
      entityId: token.record.userId,
      ipAddress: requestIp(request),
    })

    return reply.send({ success: true })
  })

  app.post('/api/auth/forgot-password', { config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parsed = forgotSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ message: 'Invalid forgot password payload' })

    const safeResponse = { success: true, message: 'If the account exists, a reset process has been started.' }
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase().trim() } })
    if (!user || user.status !== 'ACTIVE') return reply.send(safeResponse)

    const { link } = await createPasswordToken(user.id, 'RESET_PASSWORD')
    await writeAuditLog({
      userId: user.id,
      action: 'password.reset.requested',
      entityType: 'User',
      entityId: user.id,
      ipAddress: requestIp(request),
    })

    return reply.send({
      ...safeResponse,
      resetLink: process.env.NODE_ENV === 'production' ? undefined : link,
    })
  })

  app.post('/api/auth/reset-password', { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parsed = passwordSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ message: 'Invalid password payload' })

    const token = await consumePasswordToken(parsed.data.token, 'RESET_PASSWORD')
    if (!token.ok) return reply.code(400).send({ message: 'This reset link is invalid or expired.' })

    const passwordHash = await hashPassword(parsed.data.newPassword)
    const completed = await prisma.$transaction(async (tx) => {
      const activeUser = await tx.user.findFirst({
        where: { id: token.record.userId, status: 'ACTIVE', isActive: true },
        select: { id: true },
      })
      if (!activeUser) return false
      const consumed = await tx.passwordToken.updateMany({
        where: { id: token.record.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      })
      if (consumed.count !== 1) return false
      await tx.user.update({
        where: { id: activeUser.id },
        data: { passwordHash, permissionVersion: { increment: 1 } },
      })
      await tx.passwordToken.updateMany({
        where: { userId: activeUser.id, type: 'RESET_PASSWORD', usedAt: null },
        data: { usedAt: new Date() },
      })
      return true
    })
    if (!completed) return reply.code(400).send({ message: 'This reset link is invalid or expired.' })

    await writeAuditLog({
      userId: token.record.userId,
      action: 'password.reset.completed',
      entityType: 'User',
      entityId: token.record.userId,
      ipAddress: requestIp(request),
    })

    return reply.send({ success: true })
  })
}
