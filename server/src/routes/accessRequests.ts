import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { requireCurrentUser } from '../auth/context.js'
import { badRequest, forbidden, notFound } from '../utils/http.js'
import { createPasswordToken } from '../services/passwordTokens.js'
import { requestIp, writeAuditLog } from '../services/audit.js'

const accessRequestSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  department: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
})

const approveSchema = z.object({
  role: z.enum(['ADMIN', 'EDITOR', 'VIEWER', 'BOSS_VIEWER']),
})

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
  app.post('/api/access-requests', async (request, reply) => {
    const parsed = accessRequestSchema.safeParse(request.body)
    if (!parsed.success) return badRequest(reply, 'Invalid access request payload', parsed.error.flatten())

    const email = parsed.data.email.toLowerCase().trim()
    const existing = await prisma.user.findUnique({ where: { email } })
    if (!existing) {
      const user = await prisma.user.create({
        data: {
          name: parsed.data.name,
          email,
          department: parsed.data.department || null,
          accessRequestMessage: parsed.data.message || null,
          status: 'PENDING_APPROVAL',
          isActive: true,
        },
      })
      await writeAuditLog({
        userId: user.id,
        action: 'access.requested',
        entityType: 'User',
        entityId: user.id,
        afterJson: { email: user.email, department: user.department, status: user.status },
        ipAddress: requestIp(request),
      })
    }

    return reply.send({
      success: true,
      message: 'Your access request has been submitted. Please wait for admin approval.',
    })
  })

  app.get('/api/admin/access-requests', async (request, reply) => {
    const admin = await requireAdmin(request, reply)
    if (!admin) return

    const requests = await prisma.user.findMany({
      where: {
        status: { in: ['PENDING_APPROVAL', 'APPROVED_NEEDS_PASSWORD', 'REJECTED'] },
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
        createdAt: true,
      },
    })

    return reply.send({ requests })
  })

  app.post('/api/admin/access-requests/:id/approve', async (request, reply) => {
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

  app.post('/api/admin/access-requests/:id/reject', async (request, reply) => {
    const admin = await requireAdmin(request, reply)
    if (!admin) return
    const params = request.params as { id: string }
    const user = await prisma.user.findUnique({ where: { id: params.id } })
    if (!user) return notFound(reply, 'Access request not found')

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
      },
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
}
