import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { clearAuthCookie, setAuthCookie } from '../utils/session.js'
import { toSafeUser } from '../utils/safeUser.js'
import { consumePasswordToken, createPasswordToken } from '../services/passwordTokens.js'
import { requestIp, writeAuditLog } from '../services/audit.js'

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

function loginStatusMessage(status: string) {
  if (status === 'PENDING_APPROVAL') return 'Your access request is still pending approval.'
  if (status === 'APPROVED_NEEDS_PASSWORD') return 'Your account has been approved. Please set your password before logging in.'
  if (status === 'REJECTED') return 'Your access request was rejected.'
  if (status === 'DISABLED') return 'Your account is disabled.'
  return 'Invalid email or password'
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ message: 'Invalid login payload' })

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase().trim() } })
    if (!user || !user.isActive) return reply.code(401).send({ message: 'Invalid email or password' })
    if (user.status !== 'ACTIVE') return reply.code(403).send({ message: loginStatusMessage(user.status) })
    if (!user.passwordHash) return reply.code(403).send({ message: 'Password setup required.' })

    const ok = await verifyPassword(parsed.data.password, user.passwordHash)
    if (!ok) return reply.code(401).send({ message: 'Invalid email or password' })

    const updated = await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    const token = await reply.jwtSign({ sub: updated.id }, { sign: { expiresIn: '7d' } })
    setAuthCookie(reply, token)
    return reply.send({ user: toSafeUser(updated) })
  })

  app.post('/api/auth/logout', async (_request, reply) => {
    clearAuthCookie(reply)
    return reply.send({ success: true })
  })

  app.get('/api/auth/me', async (request, reply) => {
    try {
      if (!request.cookies.crew_chart_session) return reply.code(401).send({ message: 'Not authenticated' })
      const payload = await request.jwtVerify<{ sub: string }>()
      const user = await prisma.user.findUnique({ where: { id: payload.sub } })
      if (!user || !user.isActive || user.status !== 'ACTIVE') return reply.code(401).send({ message: 'Not authenticated' })
      return reply.send({ user: toSafeUser(user) })
    } catch {
      return reply.code(401).send({ message: 'Not authenticated' })
    }
  })

  app.post('/api/auth/set-password', async (request, reply) => {
    const parsed = passwordSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ message: 'Invalid password payload' })

    const token = await consumePasswordToken(parsed.data.token, 'SET_PASSWORD')
    if (!token.ok) return reply.code(400).send({ message: 'This password setup link is invalid or expired.' })

    const passwordHash = await hashPassword(parsed.data.newPassword)
    await prisma.$transaction([
      prisma.user.update({
        where: { id: token.record.userId },
        data: {
          passwordHash,
          status: 'ACTIVE',
          isActive: true,
        },
      }),
      prisma.passwordToken.update({
        where: { id: token.record.id },
        data: { usedAt: new Date() },
      }),
    ])

    await writeAuditLog({
      userId: token.record.userId,
      action: 'password.setup.completed',
      entityType: 'User',
      entityId: token.record.userId,
      ipAddress: requestIp(request),
    })

    return reply.send({ success: true })
  })

  app.post('/api/auth/forgot-password', async (request, reply) => {
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

  app.post('/api/auth/reset-password', async (request, reply) => {
    const parsed = passwordSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ message: 'Invalid password payload' })

    const token = await consumePasswordToken(parsed.data.token, 'RESET_PASSWORD')
    if (!token.ok) return reply.code(400).send({ message: 'This reset link is invalid or expired.' })

    const passwordHash = await hashPassword(parsed.data.newPassword)
    await prisma.$transaction([
      prisma.user.update({
        where: { id: token.record.userId },
        data: { passwordHash },
      }),
      prisma.passwordToken.update({
        where: { id: token.record.id },
        data: { usedAt: new Date() },
      }),
    ])

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
