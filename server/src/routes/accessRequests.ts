import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { requireCurrentUser } from '../auth/context.js'
import { badRequest, forbidden, notFound } from '../utils/http.js'
import { createPasswordToken } from '../services/passwordTokens.js'
import { requestIp, writeAuditLog } from '../services/audit.js'
import { toSafeUser } from '../utils/safeUser.js'

const approveSchema = z.object({
  role: z.enum(['ADMIN', 'EDITOR', 'VIEWER']),
})

export const adminCreateUserSchema = z.object({
  name: z.string().trim().min(1, 'User name is required.').max(120, 'User name is too long.'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254, 'Email address is too long.'),
  role: z.enum(['ADMIN', 'EDITOR', 'VIEWER']),
})

const updateUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').optional(),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').optional(),
  role: z.enum(['ADMIN', 'EDITOR', 'VIEWER']).optional(),
  status: z.enum(['ACTIVE', 'DISABLED', 'APPROVED_NEEDS_PASSWORD', 'REJECTED']).optional(),
})

async function activeAdminCount() {
  return prisma.user.count({
    where: {
      role: 'ADMIN',
      isActive: true,
      status: { in: ['ACTIVE', 'APPROVED_NEEDS_PASSWORD'] },
    },
  })
}

async function requireAdmin(request: Parameters<typeof requireCurrentUser>[0], reply: Parameters<typeof requireCurrentUser>[1]) {
  const user = await requireCurrentUser(request, reply)
  if (!user) return null
  if (user.role !== 'ADMIN') {
    forbidden(reply)
    return null
  }
  return user
}

export async function accessRequestRoutes(app: FastifyInstance) {
  app.post('/api/admin/users', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    const admin = await requireAdmin(request, reply)
    if (!admin) return

    const parsed = adminCreateUserSchema.safeParse(request.body)
    if (!parsed.success) return badRequest(reply, 'Invalid user details', parsed.error.flatten())

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } })
    if (existing) return reply.code(409).send({ message: 'That email address is already in use.' })

    const created = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        role: parsed.data.role,
        status: 'APPROVED_NEEDS_PASSWORD',
        isActive: true,
        approvedByUserId: admin.id,
        approvedAt: new Date(),
      },
    })
    const { link } = await createPasswordToken(created.id, 'SET_PASSWORD')

    await writeAuditLog({
      userId: admin.id,
      action: 'user.created',
      entityType: 'User',
      entityId: created.id,
      afterJson: { name: created.name, email: created.email, role: created.role, status: created.status },
      ipAddress: requestIp(request),
    })

    return reply.code(201).send({
      success: true,
      user: toSafeUser(created),
      setupLink: link,
      message: 'User created. Share this one-time setup link securely.',
    })
  })

  app.get('/api/admin/access-requests', { config: { rateLimit: { max: 90, timeWindow: '1 minute' } } }, async (request, reply) => {
    const admin = await requireAdmin(request, reply)
    if (!admin) return

    const requests = await prisma.user.findMany({
      where: {
        status: { in: ['PENDING_APPROVAL', 'APPROVED_NEEDS_PASSWORD', 'ACTIVE', 'REJECTED', 'DISABLED'] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        accessRequestMessage: true,
        role: true,
        status: true,
        approvedAt: true,
        rejectedAt: true,
        lastLoginAt: true,
        isActive: true,
        createdAt: true,
      },
    })

    return reply.send({ requests })
  })

  app.post('/api/admin/access-requests/:id/approve', { config: { rateLimit: { max: 40, timeWindow: '1 minute' } } }, async (request, reply) => {
    const admin = await requireAdmin(request, reply)
    if (!admin) return

    const params = request.params as { id: string }
    const parsed = approveSchema.safeParse(request.body)
    if (!parsed.success) return badRequest(reply, 'Invalid approval payload', parsed.error.flatten())

    const user = await prisma.user.findUnique({ where: { id: params.id } })
    if (!user) return notFound(reply, 'Access request not found')

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        role: parsed.data.role,
        status: 'APPROVED_NEEDS_PASSWORD',
        permissionVersion: { increment: 1 },
        approvedByUserId: admin.id,
        approvedAt: new Date(),
        rejectedAt: null,
      },
    })
    const { link } = await createPasswordToken(updated.id, 'SET_PASSWORD')
    await writeAuditLog({
      userId: admin.id,
      action: 'access.approved',
      entityType: 'User',
      entityId: updated.id,
      beforeJson: { status: user.status, role: user.role },
      afterJson: { status: updated.status, role: updated.role },
      ipAddress: requestIp(request),
    })

    return reply.send({
      success: true,
      setupLink: link,
      message: 'Access approved. Share this one-time setup link manually.',
    })
  })

  app.post('/api/admin/access-requests/:id/reject', { config: { rateLimit: { max: 40, timeWindow: '1 minute' } } }, async (request, reply) => {
    const admin = await requireAdmin(request, reply)
    if (!admin) return
    const params = request.params as { id: string }
    const user = await prisma.user.findUnique({ where: { id: params.id } })
    if (!user) return notFound(reply, 'Access request not found')

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id: user.id },
        data: {
          status: 'REJECTED',
          permissionVersion: { increment: 1 },
          rejectedAt: new Date(),
        },
      })
      await tx.passwordToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      })
      return result
    })

    await writeAuditLog({
      userId: admin.id,
      action: 'access.rejected',
      entityType: 'User',
      entityId: updated.id,
      beforeJson: { status: user.status },
      afterJson: { status: updated.status },
      ipAddress: requestIp(request),
    })

    return reply.send({ success: true })
  })

  app.post('/api/admin/users/:id/setup-link', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request, reply) => {
    const admin = await requireAdmin(request, reply)
    if (!admin) return

    const params = request.params as { id: string }
    const user = await prisma.user.findUnique({ where: { id: params.id } })
    if (!user) return notFound(reply, 'User not found')
    if (user.status === 'DISABLED' || user.status === 'REJECTED') return badRequest(reply, 'Cannot generate a setup link for this user.')

    const tokenType = user.status === 'APPROVED_NEEDS_PASSWORD' ? 'SET_PASSWORD' : 'RESET_PASSWORD'
    const { link } = await createPasswordToken(user.id, tokenType)
    await writeAuditLog({
      userId: admin.id,
      action: tokenType === 'SET_PASSWORD' ? 'access.setup_link.regenerated' : 'access.reset_link.generated',
      entityType: 'User',
      entityId: user.id,
      ipAddress: requestIp(request),
    })

    return reply.send({
      success: true,
      setupLink: link,
      message: tokenType === 'SET_PASSWORD' ? 'New setup link generated.' : 'Password reset link generated.',
    })
  })

  app.patch('/api/admin/users/:id', { config: { rateLimit: { max: 40, timeWindow: '1 minute' } } }, async (request, reply) => {
    const admin = await requireAdmin(request, reply)
    if (!admin) return

    const params = request.params as { id: string }
    const parsed = updateUserSchema.safeParse(request.body)
    if (!parsed.success) return badRequest(reply, 'Invalid user update payload', parsed.error.flatten())

    const user = await prisma.user.findUnique({ where: { id: params.id } })
    if (!user) return notFound(reply, 'User not found')
    if (user.id === admin.id && parsed.data.role && parsed.data.role !== 'ADMIN') return badRequest(reply, 'You cannot remove your own admin role.')
    if (user.id === admin.id && parsed.data.email && parsed.data.email !== user.email) return badRequest(reply, 'Use Account settings to change your own email address securely.')
    if (parsed.data.email && parsed.data.email !== user.email) {
      const duplicate = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } })
      if (duplicate) return reply.code(409).send({ message: 'That email address is already in use.' })
    }

    const nextRole = parsed.data.role ?? user.role
    const nextStatus = parsed.data.status ?? user.status
    const nextIsActive = nextStatus !== 'DISABLED'
    const nextName = parsed.data.name ?? user.name
    const nextEmail = parsed.data.email ?? user.email
    const permissionChanged = nextRole !== user.role || nextStatus !== user.status || nextIsActive !== user.isActive || nextEmail !== user.email
    const removingAdminPower = user.role === 'ADMIN' && (nextRole !== 'ADMIN' || !nextIsActive)
    if (removingAdminPower && await activeAdminCount() <= 1) {
      return badRequest(reply, 'The last remaining admin cannot be disabled or downgraded.')
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id: user.id },
        data: {
          name: nextName,
          email: nextEmail,
          role: nextRole,
          status: nextStatus,
          isActive: nextIsActive,
          permissionVersion: permissionChanged ? { increment: 1 } : undefined,
          approvedAt: nextStatus === 'ACTIVE' || nextStatus === 'APPROVED_NEEDS_PASSWORD' ? user.approvedAt ?? new Date() : user.approvedAt,
          rejectedAt: nextStatus === 'REJECTED' ? new Date() : null,
        },
      })
      if (nextStatus === 'DISABLED' || nextStatus === 'REJECTED') {
        await tx.passwordToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } })
      }
      return result
    })

    await writeAuditLog({
      userId: admin.id,
      action: 'user.updated',
      entityType: 'User',
      entityId: updated.id,
      beforeJson: { name: user.name, email: user.email, role: user.role, status: user.status, isActive: user.isActive },
      afterJson: { name: updated.name, email: updated.email, role: updated.role, status: updated.status, isActive: updated.isActive },
      ipAddress: requestIp(request),
    })

    return reply.send({ success: true, user: toSafeUser(updated) })
  })
}
