import type { FastifyInstance } from 'fastify'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { requireCurrentUser } from '../auth/context.js'
import { allocationSchema, organizationSchema, personSchema, vesselSchema } from '../validation/schemas.js'
import { badRequest, created, forbidden, noContent, notFound } from '../utils/http.js'
import { requestIp, writeAuditLog } from '../services/audit.js'
import { getOrganizationHierarchy } from '../services/hierarchy.js'
import { listVesselsWithAllocation } from '../services/vessels.js'
import { toNullableDate, entitySnapshot } from '../utils/parse.js'

async function getPrimaryOrganization() {
  return prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } })
}

async function ensureAuthorizedWrite(request: Parameters<typeof requireCurrentUser>[0], reply: Parameters<typeof requireCurrentUser>[1]) {
  const user = await requireCurrentUser(request, reply)
  if (!user) return null
  if (user.role !== 'ADMIN' && user.role !== 'EDITOR') {
    forbidden(reply)
    return null
  }
  return user
}

async function ensureAdmin(request: Parameters<typeof requireCurrentUser>[0], reply: Parameters<typeof requireCurrentUser>[1]) {
  const user = await requireCurrentUser(request, reply)
  if (!user) return null
  if (user.role !== 'ADMIN') {
    forbidden(reply)
    return null
  }
  return user
}

export async function organizationRoutes(app: FastifyInstance) {
  app.get('/api/organization', async (request, reply) => {
    const user = await requireCurrentUser(request, reply)
    if (!user) return
    const organization = await getPrimaryOrganization()
    return reply.send({ organization })
  })

  app.patch('/api/organization', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return

    const parsed = organizationSchema.extend({
      crewDirectorName: personSchema.shape.name.optional(),
      crewDirectorDesignation: personSchema.shape.designation.optional(),
      crewDirectorEmail: personSchema.shape.email.optional(),
      crewDirectorPhone: personSchema.shape.phone.optional(),
      crewDirectorNotes: personSchema.shape.notes.optional(),
    }).safeParse(request.body)
    if (!parsed.success) return badRequest(reply, 'Invalid organization payload', parsed.error.flatten())

    const current = await getPrimaryOrganization()
    const before = current ? entitySnapshot(current) : null
    const organization = await prisma.$transaction(async (tx) => {
      const org = current
        ? await tx.organization.update({
            where: { id: current.id },
            data: {
              name: parsed.data.name,
              title: parsed.data.title,
              effectiveDate: toNullableDate(parsed.data.effectiveDate),
              footerText: parsed.data.footerText ?? null,
            },
          })
        : await tx.organization.create({
            data: {
              name: parsed.data.name,
              title: parsed.data.title,
              effectiveDate: toNullableDate(parsed.data.effectiveDate),
              footerText: parsed.data.footerText ?? null,
            },
          })

      if (parsed.data.crewDirectorName && parsed.data.crewDirectorDesignation) {
        const director = await tx.person.findFirst({
          where: { organizationId: org.id, workflowRole: 'CREW_DIRECTOR' },
        })
        if (director) {
          await tx.person.update({
            where: { id: director.id },
            data: {
              name: parsed.data.crewDirectorName,
              designation: parsed.data.crewDirectorDesignation,
              email: parsed.data.crewDirectorEmail || null,
              phone: parsed.data.crewDirectorPhone || null,
              notes: parsed.data.crewDirectorNotes || null,
            },
          })
        } else {
          await tx.person.create({
            data: {
              organizationId: org.id,
              name: parsed.data.crewDirectorName,
              designation: parsed.data.crewDirectorDesignation,
              workflowRole: 'CREW_DIRECTOR',
              email: parsed.data.crewDirectorEmail || null,
              phone: parsed.data.crewDirectorPhone || null,
              notes: parsed.data.crewDirectorNotes || null,
            },
          })
        }
      }
      return org
    })

    await writeAuditLog({
      userId: user.id,
      action: current ? 'organization.update' : 'organization.create',
      entityType: 'Organization',
      entityId: organization.id,
      beforeJson: before,
      afterJson: organization,
      ipAddress: requestIp(request),
    })

    return reply.send({ organization })
  })

  app.get('/api/hierarchy', async (request, reply) => {
    const user = await requireCurrentUser(request, reply)
    if (!user) return
    const organization = await getPrimaryOrganization()
    if (!organization) return notFound(reply, 'Organization not configured')
    const hierarchy = await getOrganizationHierarchy(organization.id)
    return reply.send(hierarchy)
  })

  app.post('/api/operations-managers', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const parsed = personSchema.safeParse(request.body)
    if (!parsed.success) return badRequest(reply, 'Invalid operations manager payload', parsed.error.flatten())
    const org = await getPrimaryOrganization()
    if (!org) return notFound(reply, 'Organization not configured')
    if (parsed.data.workflowRole !== 'OPERATIONS_MANAGER') return badRequest(reply, 'workflowRole must be OPERATIONS_MANAGER')
    const createdManager = await prisma.$transaction(async (tx) => {
      const person = await tx.person.create({ data: { ...parsed.data, email: parsed.data.email || null, phone: parsed.data.phone || null, notes: parsed.data.notes || null } })
      return tx.operationsManager.create({
        data: { organizationId: org.id, personId: person.id, sortOrder: 0 },
        include: { person: true },
      })
    })
    await writeAuditLog({ userId: user.id, action: 'operationsManager.create', entityType: 'OperationsManager', entityId: createdManager.id, afterJson: createdManager, ipAddress: requestIp(request) })
    return created(reply, createdManager)
  })

  app.patch('/api/operations-managers/:id', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const parsed = personSchema.partial().safeParse(request.body)
    if (!parsed.success) return badRequest(reply, 'Invalid operations manager payload', parsed.error.flatten())
    const params = request.params as { id: string }
    const existing = await prisma.operationsManager.findUnique({ where: { id: params.id }, include: { person: true, crewManagers: true } })
    if (!existing) return notFound(reply, 'Operations manager not found')
    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.name || parsed.data.designation || parsed.data.email || parsed.data.phone || parsed.data.notes) {
        await tx.person.update({
          where: { id: existing.personId },
          data: {
            name: parsed.data.name ?? existing.person.name,
            designation: parsed.data.designation ?? existing.person.designation,
            email: parsed.data.email === '' ? null : parsed.data.email ?? existing.person.email,
            phone: parsed.data.phone === '' ? null : parsed.data.phone ?? existing.person.phone,
            notes: parsed.data.notes === '' ? null : parsed.data.notes ?? existing.person.notes,
          },
        })
      }
      return tx.operationsManager.findUnique({ where: { id: existing.id }, include: { person: true, crewManagers: true } })
    })
    if (!updated) return notFound(reply, 'Operations manager not found')
    await writeAuditLog({ userId: user.id, action: 'operationsManager.update', entityType: 'OperationsManager', entityId: updated.id, beforeJson: existing, afterJson: updated, ipAddress: requestIp(request) })
    return reply.send(updated)
  })

  app.delete('/api/operations-managers/:id', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const params = request.params as { id: string }
    const existing = await prisma.operationsManager.findUnique({ where: { id: params.id }, include: { crewManagers: true, person: true } })
    if (!existing) return notFound(reply, 'Operations manager not found')
    if (existing.crewManagers.length) return badRequest(reply, 'Move or delete crew managers before deleting this operations manager')
    await prisma.operationsManager.delete({ where: { id: existing.id } })
    await writeAuditLog({ userId: user.id, action: 'operationsManager.delete', entityType: 'OperationsManager', entityId: existing.id, beforeJson: existing, ipAddress: requestIp(request) })
    return noContent(reply)
  })

  app.post('/api/crew-managers', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const parsed = personSchema.extend({ operationsManagerId: z.string().min(1) }).safeParse(request.body)
    if (!parsed.success) return badRequest(reply, 'Invalid crew manager payload', parsed.error.flatten())
    if (parsed.data.workflowRole !== 'CREW_MANAGER') return badRequest(reply, 'workflowRole must be CREW_MANAGER')
    const org = await getPrimaryOrganization()
    if (!org) return notFound(reply, 'Organization not configured')
    const parent = await prisma.operationsManager.findUnique({ where: { id: parsed.data.operationsManagerId } })
    if (!parent) return notFound(reply, 'Operations manager not found')
    const createdManager = await prisma.$transaction(async (tx) => {
      const person = await tx.person.create({ data: { organizationId: org.id, name: parsed.data.name, designation: parsed.data.designation, workflowRole: 'CREW_MANAGER', email: parsed.data.email || null, phone: parsed.data.phone || null, notes: parsed.data.notes || null } })
      return tx.crewManager.create({ data: { organizationId: org.id, operationsManagerId: parent.id, personId: person.id, sortOrder: 0 }, include: { person: true } })
    })
    await writeAuditLog({ userId: user.id, action: 'crewManager.create', entityType: 'CrewManager', entityId: createdManager.id, afterJson: createdManager, ipAddress: requestIp(request) })
    return created(reply, createdManager)
  })

  app.patch('/api/crew-managers/:id', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const parsed = personSchema.partial().extend({ operationsManagerId: z.string().min(1).optional() }).safeParse(request.body)
    if (!parsed.success) return badRequest(reply, 'Invalid crew manager payload', parsed.error.flatten())
    const params = request.params as { id: string }
    const existing = await prisma.crewManager.findUnique({ where: { id: params.id }, include: { person: true, assistants: true, vesselAllocations: true } })
    if (!existing) return notFound(reply, 'Crew manager not found')
    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.operationsManagerId && parsed.data.operationsManagerId !== existing.operationsManagerId) {
        await tx.crewManager.update({ where: { id: existing.id }, data: { operationsManagerId: parsed.data.operationsManagerId } })
      }
      if (parsed.data.name || parsed.data.designation || parsed.data.email || parsed.data.phone || parsed.data.notes) {
        await tx.person.update({
          where: { id: existing.personId },
          data: {
            name: parsed.data.name ?? existing.person.name,
            designation: parsed.data.designation ?? existing.person.designation,
            email: parsed.data.email === '' ? null : parsed.data.email ?? existing.person.email,
            phone: parsed.data.phone === '' ? null : parsed.data.phone ?? existing.person.phone,
            notes: parsed.data.notes === '' ? null : parsed.data.notes ?? existing.person.notes,
          },
        })
      }
      return tx.crewManager.findUnique({ where: { id: existing.id }, include: { person: true, assistants: true, vesselAllocations: true } })
    })
    if (!updated) return notFound(reply, 'Crew manager not found')
    await writeAuditLog({ userId: user.id, action: 'crewManager.update', entityType: 'CrewManager', entityId: updated.id, beforeJson: existing, afterJson: updated, ipAddress: requestIp(request) })
    return reply.send(updated)
  })

  app.delete('/api/crew-managers/:id', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const params = request.params as { id: string }
    const existing = await prisma.crewManager.findUnique({ where: { id: params.id }, include: { assistants: true, vesselAllocations: true, person: true } })
    if (!existing) return notFound(reply, 'Crew manager not found')
    if (existing.assistants.length || existing.vesselAllocations.length) {
      return badRequest(reply, 'Clear assistants and vessel allocations before deleting this crew manager')
    }
    await prisma.crewManager.delete({ where: { id: existing.id } })
    await writeAuditLog({ userId: user.id, action: 'crewManager.delete', entityType: 'CrewManager', entityId: existing.id, beforeJson: existing, ipAddress: requestIp(request) })
    return noContent(reply)
  })

  app.post('/api/assistants', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const parsed = personSchema.extend({ crewManagerId: z.string().min(1) }).safeParse(request.body)
    if (!parsed.success) return badRequest(reply, 'Invalid assistant payload', parsed.error.flatten())
    if (parsed.data.workflowRole !== 'ASSISTANT') return badRequest(reply, 'workflowRole must be ASSISTANT')
    const org = await getPrimaryOrganization()
    if (!org) return notFound(reply, 'Organization not configured')
    const parent = await prisma.crewManager.findUnique({ where: { id: parsed.data.crewManagerId } })
    if (!parent) return notFound(reply, 'Crew manager not found')
    const createdAssistant = await prisma.$transaction(async (tx) => {
      const person = await tx.person.create({ data: { organizationId: org.id, name: parsed.data.name, designation: parsed.data.designation, workflowRole: 'ASSISTANT', email: parsed.data.email || null, phone: parsed.data.phone || null, notes: parsed.data.notes || null } })
      return tx.assistant.create({ data: { organizationId: org.id, crewManagerId: parent.id, personId: person.id, sortOrder: 0 }, include: { person: true } })
    })
    await writeAuditLog({ userId: user.id, action: 'assistant.create', entityType: 'Assistant', entityId: createdAssistant.id, afterJson: createdAssistant, ipAddress: requestIp(request) })
    return created(reply, createdAssistant)
  })

  app.patch('/api/assistants/:id', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const parsed = personSchema.partial().extend({ crewManagerId: z.string().min(1).optional() }).safeParse(request.body)
    if (!parsed.success) return badRequest(reply, 'Invalid assistant payload', parsed.error.flatten())
    const params = request.params as { id: string }
    const existing = await prisma.assistant.findUnique({ where: { id: params.id }, include: { person: true, vesselAllocations: true } })
    if (!existing) return notFound(reply, 'Assistant not found')
    if (parsed.data.crewManagerId) {
      const parent = await prisma.crewManager.findUnique({ where: { id: parsed.data.crewManagerId } })
      if (!parent) return notFound(reply, 'Crew manager not found')
    }
    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.crewManagerId && parsed.data.crewManagerId !== existing.crewManagerId) {
        await tx.assistant.update({ where: { id: existing.id }, data: { crewManagerId: parsed.data.crewManagerId } })
      }
      if (parsed.data.name || parsed.data.designation || parsed.data.email || parsed.data.phone || parsed.data.notes) {
        await tx.person.update({
          where: { id: existing.personId },
          data: {
            name: parsed.data.name ?? existing.person.name,
            designation: parsed.data.designation ?? existing.person.designation,
            email: parsed.data.email === '' ? null : parsed.data.email ?? existing.person.email,
            phone: parsed.data.phone === '' ? null : parsed.data.phone ?? existing.person.phone,
            notes: parsed.data.notes === '' ? null : parsed.data.notes ?? existing.person.notes,
          },
        })
      }
      return tx.assistant.findUnique({ where: { id: existing.id }, include: { person: true, vesselAllocations: true } })
    })
    if (!updated) return notFound(reply, 'Assistant not found')
    await writeAuditLog({ userId: user.id, action: 'assistant.update', entityType: 'Assistant', entityId: updated.id, beforeJson: existing, afterJson: updated, ipAddress: requestIp(request) })
    return reply.send(updated)
  })

  app.delete('/api/assistants/:id', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const params = request.params as { id: string }
    const existing = await prisma.assistant.findUnique({ where: { id: params.id }, include: { vesselAllocations: true, person: true } })
    if (!existing) return notFound(reply, 'Assistant not found')
    if (existing.vesselAllocations.length) return badRequest(reply, 'Clear vessel assignments before deleting this assistant')
    await prisma.assistant.delete({ where: { id: existing.id } })
    await writeAuditLog({ userId: user.id, action: 'assistant.delete', entityType: 'Assistant', entityId: existing.id, beforeJson: existing, ipAddress: requestIp(request) })
    return noContent(reply)
  })

  app.get('/api/vessels', async (request, reply) => {
    const user = await requireCurrentUser(request, reply)
    if (!user) return
    const org = await getPrimaryOrganization()
    if (!org) return reply.send({ vessels: [] })
    const vessels = await listVesselsWithAllocation(org.id)
    return reply.send({ vessels })
  })

  app.post('/api/vessels', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const parsed = vesselSchema.safeParse(request.body)
    if (!parsed.success) return badRequest(reply, 'Invalid vessel payload', parsed.error.flatten())
    const org = await getPrimaryOrganization()
    if (!org) return notFound(reply, 'Organization not configured')
    const createdVessel = await prisma.vessel.create({
      data: {
        ...parsed.data,
        organizationId: org.id,
        takeoverDate: toNullableDate(parsed.data.takeoverDate),
        handoverDate: toNullableDate(parsed.data.handoverDate),
        vesselStatus: parsed.data.vesselStatus,
        managementType: parsed.data.managementType,
        sortOrder: parsed.data.sortOrder ?? 0,
      },
    })
    await writeAuditLog({ userId: user.id, action: 'vessel.create', entityType: 'Vessel', entityId: createdVessel.id, afterJson: createdVessel, ipAddress: requestIp(request) })
    return created(reply, createdVessel)
  })

  app.patch('/api/vessels/:id', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const parsed = vesselSchema.partial().safeParse(request.body)
    if (!parsed.success) return badRequest(reply, 'Invalid vessel payload', parsed.error.flatten())
    const params = request.params as { id: string }
    const existing = await prisma.vessel.findUnique({ where: { id: params.id }, include: { vesselAllocations: { take: 1, orderBy: { allocatedAt: 'desc' } } } })
    if (!existing) return notFound(reply, 'Vessel not found')
    const updated = await prisma.vessel.update({
      where: { id: existing.id },
      data: {
        ...parsed.data,
        takeoverDate: parsed.data.takeoverDate !== undefined ? toNullableDate(parsed.data.takeoverDate) : undefined,
        handoverDate: parsed.data.handoverDate !== undefined ? toNullableDate(parsed.data.handoverDate) : undefined,
      } as Prisma.VesselUpdateInput,
    })
    await writeAuditLog({ userId: user.id, action: 'vessel.update', entityType: 'Vessel', entityId: updated.id, beforeJson: existing, afterJson: updated, ipAddress: requestIp(request) })
    return reply.send(updated)
  })

  app.delete('/api/vessels/:id', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const params = request.params as { id: string }
    const existing = await prisma.vessel.findUnique({ where: { id: params.id }, include: { vesselAllocations: true } })
    if (!existing) return notFound(reply, 'Vessel not found')
    await prisma.vesselAllocation.deleteMany({ where: { vesselId: existing.id } })
    await prisma.vessel.delete({ where: { id: existing.id } })
    await writeAuditLog({ userId: user.id, action: 'vessel.delete', entityType: 'Vessel', entityId: existing.id, beforeJson: existing, ipAddress: requestIp(request) })
    return noContent(reply)
  })

  app.patch('/api/vessels/:id/allocation', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const parsed = allocationSchema.safeParse(request.body)
    if (!parsed.success) return badRequest(reply, 'Invalid allocation payload', parsed.error.flatten())
    const params = request.params as { id: string }
    const vessel = await prisma.vessel.findUnique({ where: { id: params.id } })
    if (!vessel) return notFound(reply, 'Vessel not found')
    const crewManager = await prisma.crewManager.findUnique({ where: { id: parsed.data.crewManagerId }, include: { assistants: true } })
    if (!crewManager) return notFound(reply, 'Crew manager not found')
    const assistantId: string | null = parsed.data.assignedAssistantId || null
    if (assistantId) {
      const assistant = crewManager.assistants.find((item) => item.id === assistantId)
      if (!assistant) return badRequest(reply, 'Assigned assistant must belong to the selected crew manager')
    }
    const before = await prisma.vesselAllocation.findUnique({ where: { vesselId: vessel.id } })
    const allocation = await prisma.vesselAllocation.upsert({
      where: { vesselId: vessel.id },
      create: {
        vesselId: vessel.id,
        crewManagerId: crewManager.id,
        assignedAssistantId: assistantId,
        allocatedAt: new Date(),
      },
      update: {
        crewManagerId: crewManager.id,
        assignedAssistantId: assistantId,
        allocatedAt: new Date(),
      },
    })
    await writeAuditLog({ userId: user.id, action: 'vessel.allocation.update', entityType: 'VesselAllocation', entityId: allocation.id, beforeJson: before, afterJson: allocation, ipAddress: requestIp(request) })
    return reply.send(allocation)
  })

  app.get('/api/reports/summary', async (request, reply) => {
    const user = await requireCurrentUser(request, reply)
    if (!user) return
    const org = await getPrimaryOrganization()
    if (!org) return reply.send({ organization: null, counts: { operationsManagers: 0, crewManagers: 0, assistants: 0, vessels: 0 } })
    const [operationsManagers, crewManagers, assistants, vessels] = await Promise.all([
      prisma.operationsManager.count({ where: { organizationId: org.id } }),
      prisma.crewManager.count({ where: { organizationId: org.id } }),
      prisma.assistant.count({ where: { organizationId: org.id } }),
      prisma.vessel.count({ where: { organizationId: org.id } }),
    ])
    return reply.send({ organization: org, counts: { operationsManagers, crewManagers, assistants, vessels } })
  })

  app.get('/api/reports/vessel-allocation', async (request, reply) => {
    const user = await requireCurrentUser(request, reply)
    if (!user) return
    const org = await getPrimaryOrganization()
    if (!org) return reply.send({ vessels: [] })
    const vessels = await listVesselsWithAllocation(org.id)
    return reply.send({ vessels })
  })

  app.get('/api/audit-logs', async (request, reply) => {
    const user = await ensureAdmin(request, reply)
    if (!user) return
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
    return reply.send({ logs })
  })
}
