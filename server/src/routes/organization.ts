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
import { firstZodMessage } from '../utils/validation.js'

async function getPrimaryOrganization() {
  return prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } })
}

async function resolveCrewManagerReportingLine(
  organizationId: string,
  crewManagerId: string,
  reportingLineId?: string | null,
) {
  const line = reportingLineId
    ? await prisma.crewManagerReportingLine.findUnique({ where: { id: reportingLineId } })
    : await prisma.crewManagerReportingLine.findFirst({
        where: { organizationId, crewManagerId, isPrimary: true },
        orderBy: { createdAt: 'asc' },
      })
  if (!line || line.organizationId !== organizationId || line.crewManagerId !== crewManagerId) return null
  return line
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

const hierarchyPlacementSchema = z.object({
  entityType: z.enum(['OPERATIONS_MANAGER', 'DEPUTY_MANAGER', 'CREW_MANAGER']),
  entityId: z.string().trim().min(1),
  parentId: z.string().trim().min(1),
  parentPlacementId: z.string().trim().min(1).optional(),
  action: z.enum(['MOVE', 'COPY']),
})

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

    const parsed = organizationSchema.safeParse(request.body)
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

  app.post('/api/hierarchy/placements', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const parsed = hierarchyPlacementSchema.safeParse(request.body)
    if (!parsed.success) return badRequest(reply, 'Invalid hierarchy placement', parsed.error.flatten())

    const { entityType, entityId, parentId, parentPlacementId, action } = parsed.data
    const organization = await getPrimaryOrganization()
    if (!organization) return notFound(reply, 'Organization not configured')

    const result = await prisma.$transaction(async (tx) => {
      if (entityType === 'OPERATIONS_MANAGER') {
        const [entity, parent, existingLine] = await Promise.all([
          tx.operationsManager.findUnique({ where: { id: entityId }, include: { person: true, reportingLines: true } }),
          tx.crewDirector.findUnique({ where: { id: parentId }, include: { person: true } }),
          tx.operationsManagerReportingLine.findUnique({ where: { operationsManagerId_crewDirectorId: { operationsManagerId: entityId, crewDirectorId: parentId } } }),
        ])
        if (!entity || entity.organizationId !== organization.id) throw new Error('ENTITY_NOT_FOUND')
        if (!parent || parent.organizationId !== organization.id) throw new Error('PARENT_NOT_FOUND')
        if (action === 'COPY' && existingLine) throw new Error('ALREADY_REPORTS')

        if (action === 'COPY') {
          await tx.operationsManagerReportingLine.create({
            data: { organizationId: organization.id, operationsManagerId: entity.id, crewDirectorId: parent.id, isPrimary: false },
          })
        } else {
          const primaryLine = entity.reportingLines.find((line) => line.isPrimary) ?? entity.reportingLines[0]
          await tx.operationsManager.update({ where: { id: entity.id }, data: { crewDirectorId: parent.id } })
          if (existingLine && existingLine.id !== primaryLine?.id) {
            await tx.operationsManagerReportingLine.delete({ where: { id: existingLine.id } })
          }
          if (primaryLine) {
            await tx.operationsManagerReportingLine.update({
              where: { id: primaryLine.id },
              data: { crewDirectorId: parent.id, isPrimary: true },
            })
            await tx.operationsManagerReportingLine.deleteMany({
              where: { operationsManagerId: entity.id, id: { not: primaryLine.id } },
            })
          } else {
            await tx.operationsManagerReportingLine.create({
              data: { organizationId: organization.id, operationsManagerId: entity.id, crewDirectorId: parent.id, isPrimary: true },
            })
          }
        }
        return { entityName: entity.person.name, parentName: parent.person.name }
      }

      if (entityType === 'DEPUTY_MANAGER') {
        const [entity, parent] = await Promise.all([
          tx.deputyManager.findUnique({ where: { id: entityId }, include: { person: true, reportingLines: true } }),
          tx.operationsManager.findUnique({ where: { id: parentId }, include: { person: true } }),
        ])
        if (!entity || entity.organizationId !== organization.id) throw new Error('ENTITY_NOT_FOUND')
        if (!parent || parent.organizationId !== organization.id) throw new Error('PARENT_NOT_FOUND')
        const parentPlacement = parentPlacementId
          ? await tx.operationsManagerReportingLine.findUnique({ where: { id: parentPlacementId } })
          : await tx.operationsManagerReportingLine.findFirst({ where: { operationsManagerId: parent.id, isPrimary: true } })
        if (!parentPlacement || parentPlacement.operationsManagerId !== parent.id || parentPlacement.organizationId !== organization.id) {
          throw new Error('PARENT_PLACEMENT_NOT_FOUND')
        }
        const existingLine = await tx.deputyManagerReportingLine.findUnique({
          where: {
            deputyManagerId_operationsManagerReportingLineId: {
              deputyManagerId: entity.id,
              operationsManagerReportingLineId: parentPlacement.id,
            },
          },
        })
        if (action === 'COPY' && existingLine) throw new Error('ALREADY_REPORTS')

        if (action === 'COPY') {
          await tx.deputyManagerReportingLine.create({
            data: {
              organizationId: organization.id,
              deputyManagerId: entity.id,
              operationsManagerId: parent.id,
              operationsManagerReportingLineId: parentPlacement.id,
              isPrimary: false,
            },
          })
        } else {
          const primaryLine = entity.reportingLines.find((line) => line.isPrimary) ?? entity.reportingLines[0]
          await tx.deputyManager.update({ where: { id: entity.id }, data: { operationsManagerId: parent.id } })
          if (existingLine && existingLine.id !== primaryLine?.id) {
            await tx.deputyManagerReportingLine.delete({ where: { id: existingLine.id } })
          }
          if (primaryLine) {
            await tx.deputyManagerReportingLine.update({
              where: { id: primaryLine.id },
              data: {
                operationsManagerId: parent.id,
                operationsManagerReportingLineId: parentPlacement.id,
                isPrimary: true,
              },
            })
            await tx.deputyManagerReportingLine.deleteMany({
              where: { deputyManagerId: entity.id, id: { not: primaryLine.id } },
            })
          } else {
            await tx.deputyManagerReportingLine.create({
              data: {
                organizationId: organization.id,
                deputyManagerId: entity.id,
                operationsManagerId: parent.id,
                operationsManagerReportingLineId: parentPlacement.id,
                isPrimary: true,
              },
            })
          }
        }
        return { entityName: entity.person.name, parentName: parent.person.name }
      }

      const [entity, parent] = await Promise.all([
        tx.crewManager.findUnique({ where: { id: entityId }, include: { person: true, reportingLines: true } }),
        tx.deputyManager.findUnique({ where: { id: parentId }, include: { person: true } }),
      ])
      if (!entity || entity.organizationId !== organization.id) throw new Error('ENTITY_NOT_FOUND')
      if (!parent || parent.organizationId !== organization.id) throw new Error('PARENT_NOT_FOUND')
      const parentPlacement = parentPlacementId
        ? await tx.deputyManagerReportingLine.findUnique({ where: { id: parentPlacementId } })
        : await tx.deputyManagerReportingLine.findFirst({ where: { deputyManagerId: parent.id, isPrimary: true } })
      if (!parentPlacement || parentPlacement.deputyManagerId !== parent.id || parentPlacement.organizationId !== organization.id) {
        throw new Error('PARENT_PLACEMENT_NOT_FOUND')
      }
      const existingLine = await tx.crewManagerReportingLine.findUnique({
        where: {
          crewManagerId_deputyManagerReportingLineId: {
            crewManagerId: entity.id,
            deputyManagerReportingLineId: parentPlacement.id,
          },
        },
      })
      if (action === 'COPY' && existingLine) throw new Error('ALREADY_REPORTS')

      if (action === 'COPY') {
        await tx.crewManagerReportingLine.create({
          data: {
            organizationId: organization.id,
            crewManagerId: entity.id,
            deputyManagerId: parent.id,
            deputyManagerReportingLineId: parentPlacement.id,
            isPrimary: false,
          },
        })
      } else {
        const primaryLine = entity.reportingLines.find((line) => line.isPrimary) ?? entity.reportingLines[0]
        await tx.crewManager.update({ where: { id: entity.id }, data: { deputyManagerId: parent.id } })
        if (primaryLine) {
          // MOVE means this Crew Manager and all vessel allocations move together.
          // Point every allocation at the retained placement before removing any
          // secondary placement so a vessel is never duplicated or unassigned.
          await tx.vesselAllocation.updateMany({
            where: { crewManagerId: entity.id },
            data: { crewManagerReportingLineId: primaryLine.id },
          })
        }
        if (existingLine && existingLine.id !== primaryLine?.id) {
          await tx.crewManagerReportingLine.delete({ where: { id: existingLine.id } })
        }
        if (primaryLine) {
          await tx.crewManagerReportingLine.update({
            where: { id: primaryLine.id },
            data: {
              deputyManagerId: parent.id,
              deputyManagerReportingLineId: parentPlacement.id,
              isPrimary: true,
            },
          })
          await tx.crewManagerReportingLine.deleteMany({
            where: { crewManagerId: entity.id, id: { not: primaryLine.id } },
          })
        } else {
          await tx.crewManagerReportingLine.create({
            data: {
              organizationId: organization.id,
              crewManagerId: entity.id,
              deputyManagerId: parent.id,
              deputyManagerReportingLineId: parentPlacement.id,
              isPrimary: true,
            },
          })
        }
      }
      return { entityName: entity.person.name, parentName: parent.person.name }
    }).catch((error: unknown) => {
      const code = error instanceof Error ? error.message : ''
      if (code === 'ENTITY_NOT_FOUND') return { error: 'The employee being moved could not be found.' }
      if (code === 'PARENT_NOT_FOUND') return { error: 'The destination employee could not be found.' }
      if (code === 'PARENT_PLACEMENT_NOT_FOUND') return { error: 'The selected destination placement is no longer available. Refresh and try again.' }
      if (code === 'ALREADY_REPORTS') return { error: 'This reporting relationship already exists.' }
      throw error
    })

    if ('error' in result) return badRequest(reply, result.error)
    await writeAuditLog({
      userId: user.id,
      action: action === 'COPY' ? 'hierarchy.reporting.copy' : 'hierarchy.reporting.move',
      entityType,
      entityId,
      afterJson: { parentId, parentPlacementId, ...result },
      ipAddress: requestIp(request),
    })
    return reply.send({ success: true, action, ...result })
  })

  app.post('/api/crew-directors', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const parsed = personSchema.safeParse(request.body)
    if (!parsed.success) return badRequest(reply, 'Invalid crew director payload', parsed.error.flatten())
    const org = await getPrimaryOrganization()
    if (!org) return notFound(reply, 'Organization not configured')
    if (parsed.data.workflowRole !== 'CREW_DIRECTOR') return badRequest(reply, 'workflowRole must be CREW_DIRECTOR')
    const createdDirector = await prisma.$transaction(async (tx) => {
      const person = await tx.person.create({ data: { organizationId: parsed.data.organizationId, name: parsed.data.name, designation: parsed.data.designation, workflowRole: parsed.data.workflowRole, email: parsed.data.email || null, phone: parsed.data.phone || null, notes: parsed.data.notes || null } })
      return tx.crewDirector.create({
        data: { organizationId: org.id, personId: person.id, sortOrder: parsed.data.sortOrder ?? 0 },
        include: { person: true },
      })
    })
    await writeAuditLog({ userId: user.id, action: 'crewDirector.create', entityType: 'CrewDirector', entityId: createdDirector.id, afterJson: createdDirector, ipAddress: requestIp(request) })
    return created(reply, createdDirector)
  })

  app.patch('/api/crew-directors/:id', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const parsed = personSchema.partial().safeParse(request.body)
    if (!parsed.success) return badRequest(reply, 'Invalid crew director payload', parsed.error.flatten())
    const params = request.params as { id: string }
    const existing = await prisma.crewDirector.findUnique({ where: { id: params.id }, include: { person: true, operationsManagers: true } })
    if (!existing) return notFound(reply, 'Crew director not found')
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
      if (parsed.data.sortOrder !== undefined) {
        await tx.crewDirector.update({ where: { id: existing.id }, data: { sortOrder: parsed.data.sortOrder } })
      }
      return tx.crewDirector.findUnique({ where: { id: existing.id }, include: { person: true, operationsManagers: true } })
    })
    if (!updated) return notFound(reply, 'Crew director not found')
    await writeAuditLog({ userId: user.id, action: 'crewDirector.update', entityType: 'CrewDirector', entityId: updated.id, beforeJson: existing, afterJson: updated, ipAddress: requestIp(request) })
    return reply.send(updated)
  })

  app.delete('/api/crew-directors/:id', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const params = request.params as { id: string }
    const existing = await prisma.crewDirector.findUnique({ where: { id: params.id }, include: { operationsManagers: true, person: true } })
    if (!existing) return notFound(reply, 'Crew director not found')
    if (existing.operationsManagers.length) return badRequest(reply, 'Move or delete operations managers before deleting this crew director')
    await prisma.crewDirector.delete({ where: { id: existing.id } })
    await writeAuditLog({ userId: user.id, action: 'crewDirector.delete', entityType: 'CrewDirector', entityId: existing.id, beforeJson: existing, ipAddress: requestIp(request) })
    return noContent(reply)
  })

  app.post('/api/operations-managers', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const parsed = personSchema.extend({ crewDirectorId: z.string().min(1) }).safeParse(request.body)
    if (!parsed.success) return badRequest(reply, 'Invalid operations manager payload', parsed.error.flatten())
    const org = await getPrimaryOrganization()
    if (!org) return notFound(reply, 'Organization not configured')
    if (parsed.data.workflowRole !== 'OPERATIONS_MANAGER') return badRequest(reply, 'workflowRole must be OPERATIONS_MANAGER')
    const parentDirector = await prisma.crewDirector.findUnique({ where: { id: parsed.data.crewDirectorId } })
    if (!parentDirector) return notFound(reply, 'Crew director not found')
    const createdManager = await prisma.$transaction(async (tx) => {
      const person = await tx.person.create({ data: { organizationId: parsed.data.organizationId, name: parsed.data.name, designation: parsed.data.designation, workflowRole: parsed.data.workflowRole, email: parsed.data.email || null, phone: parsed.data.phone || null, notes: parsed.data.notes || null } })
      const manager = await tx.operationsManager.create({
        data: { organizationId: org.id, crewDirectorId: parentDirector.id, personId: person.id, sortOrder: parsed.data.sortOrder ?? 0 },
        include: { person: true },
      })
      await tx.operationsManagerReportingLine.create({
        data: { organizationId: org.id, operationsManagerId: manager.id, crewDirectorId: parentDirector.id, isPrimary: true },
      })
      return manager
    })
    await writeAuditLog({ userId: user.id, action: 'operationsManager.create', entityType: 'OperationsManager', entityId: createdManager.id, afterJson: createdManager, ipAddress: requestIp(request) })
    return created(reply, createdManager)
  })

  app.patch('/api/operations-managers/:id', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const parsed = personSchema.partial().extend({ crewDirectorId: z.string().min(1).optional() }).safeParse(request.body)
    if (!parsed.success) return badRequest(reply, 'Invalid operations manager payload', parsed.error.flatten())
    const params = request.params as { id: string }
    const existing = await prisma.operationsManager.findUnique({ where: { id: params.id }, include: { person: true, deputyManagers: true, reportingLines: true } })
    if (!existing) return notFound(reply, 'Operations manager not found')
    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.crewDirectorId && parsed.data.crewDirectorId !== existing.crewDirectorId) {
        await tx.operationsManager.update({ where: { id: existing.id }, data: { crewDirectorId: parsed.data.crewDirectorId } })
        const primaryLine = existing.reportingLines.find((line) => line.isPrimary) ?? existing.reportingLines[0]
        if (primaryLine) {
          await tx.operationsManagerReportingLine.update({
            where: { id: primaryLine.id },
            data: { crewDirectorId: parsed.data.crewDirectorId, isPrimary: true },
          })
        } else {
          await tx.operationsManagerReportingLine.create({
            data: { organizationId: existing.organizationId, operationsManagerId: existing.id, crewDirectorId: parsed.data.crewDirectorId, isPrimary: true },
          })
        }
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
      if (parsed.data.sortOrder !== undefined) {
        await tx.operationsManager.update({ where: { id: existing.id }, data: { sortOrder: parsed.data.sortOrder } })
      }
      return tx.operationsManager.findUnique({ where: { id: existing.id }, include: { person: true, deputyManagers: true } })
    })
    if (!updated) return notFound(reply, 'Operations manager not found')
    await writeAuditLog({ userId: user.id, action: 'operationsManager.update', entityType: 'OperationsManager', entityId: updated.id, beforeJson: existing, afterJson: updated, ipAddress: requestIp(request) })
    return reply.send(updated)
  })

  app.delete('/api/operations-managers/:id', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const params = request.params as { id: string }
    const existing = await prisma.operationsManager.findUnique({ where: { id: params.id }, include: { deputyManagers: true, person: true } })
    if (!existing) return notFound(reply, 'Operations manager not found')
    if (existing.deputyManagers.length) return badRequest(reply, 'Move or delete deputy managers before deleting this operations manager')
    await prisma.operationsManager.delete({ where: { id: existing.id } })
    await writeAuditLog({ userId: user.id, action: 'operationsManager.delete', entityType: 'OperationsManager', entityId: existing.id, beforeJson: existing, ipAddress: requestIp(request) })
    return noContent(reply)
  })

  app.post('/api/deputy-managers', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const parsed = personSchema.extend({
      operationsManagerId: z.string().min(1),
      operationsManagerReportingLineId: z.string().min(1).optional(),
    }).safeParse(request.body)
    if (!parsed.success) return badRequest(reply, 'Invalid deputy manager payload', parsed.error.flatten())
    if (parsed.data.workflowRole !== 'DEPUTY_MANAGER') return badRequest(reply, 'workflowRole must be DEPUTY_MANAGER')
    const org = await getPrimaryOrganization()
    if (!org) return notFound(reply, 'Organization not configured')
    const parent = await prisma.operationsManager.findUnique({ where: { id: parsed.data.operationsManagerId } })
    if (!parent) return notFound(reply, 'Operations manager not found')
    const createdDeputy = await prisma.$transaction(async (tx) => {
      const person = await tx.person.create({ data: { organizationId: org.id, name: parsed.data.name, designation: parsed.data.designation, workflowRole: 'DEPUTY_MANAGER', email: parsed.data.email || null, phone: parsed.data.phone || null, notes: parsed.data.notes || null } })
      const deputy = await tx.deputyManager.create({ data: { organizationId: org.id, operationsManagerId: parent.id, personId: person.id, sortOrder: parsed.data.sortOrder ?? 0 }, include: { person: true } })
      const parentPlacement = parsed.data.operationsManagerReportingLineId
        ? await tx.operationsManagerReportingLine.findUnique({ where: { id: parsed.data.operationsManagerReportingLineId } })
        : await tx.operationsManagerReportingLine.findFirst({ where: { operationsManagerId: parent.id, isPrimary: true } })
      if (!parentPlacement || parentPlacement.operationsManagerId !== parent.id || parentPlacement.organizationId !== org.id) {
        throw new Error('Selected Operations Manager placement is missing')
      }
      await tx.deputyManagerReportingLine.create({
        data: {
          organizationId: org.id,
          deputyManagerId: deputy.id,
          operationsManagerId: parent.id,
          operationsManagerReportingLineId: parentPlacement.id,
          isPrimary: true,
        },
      })
      return deputy
    })
    await writeAuditLog({ userId: user.id, action: 'deputyManager.create', entityType: 'DeputyManager', entityId: createdDeputy.id, afterJson: createdDeputy, ipAddress: requestIp(request) })
    return created(reply, createdDeputy)
  })

  app.patch('/api/deputy-managers/:id', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const parsed = personSchema.partial().extend({ operationsManagerId: z.string().min(1).optional() }).safeParse(request.body)
    if (!parsed.success) return badRequest(reply, 'Invalid deputy manager payload', parsed.error.flatten())
    const params = request.params as { id: string }
    const existing = await prisma.deputyManager.findUnique({ where: { id: params.id }, include: { person: true, crewManagers: true, reportingLines: true } })
    if (!existing) return notFound(reply, 'Deputy manager not found')
    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.operationsManagerId && parsed.data.operationsManagerId !== existing.operationsManagerId) {
        const parentPlacement = await tx.operationsManagerReportingLine.findFirst({
          where: { operationsManagerId: parsed.data.operationsManagerId, isPrimary: true },
        })
        if (!parentPlacement) throw new Error('Primary Operations Manager placement is missing')
        await tx.deputyManager.update({ where: { id: existing.id }, data: { operationsManagerId: parsed.data.operationsManagerId } })
        const primaryLine = existing.reportingLines.find((line) => line.isPrimary) ?? existing.reportingLines[0]
        if (primaryLine) {
          await tx.deputyManagerReportingLine.update({
            where: { id: primaryLine.id },
            data: {
              operationsManagerId: parsed.data.operationsManagerId,
              operationsManagerReportingLineId: parentPlacement.id,
              isPrimary: true,
            },
          })
        } else {
          await tx.deputyManagerReportingLine.create({
            data: {
              organizationId: existing.organizationId,
              deputyManagerId: existing.id,
              operationsManagerId: parsed.data.operationsManagerId,
              operationsManagerReportingLineId: parentPlacement.id,
              isPrimary: true,
            },
          })
        }
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
      if (parsed.data.sortOrder !== undefined) {
        await tx.deputyManager.update({ where: { id: existing.id }, data: { sortOrder: parsed.data.sortOrder } })
      }
      return tx.deputyManager.findUnique({ where: { id: existing.id }, include: { person: true, crewManagers: true } })
    })
    if (!updated) return notFound(reply, 'Deputy manager not found')
    await writeAuditLog({ userId: user.id, action: 'deputyManager.update', entityType: 'DeputyManager', entityId: updated.id, beforeJson: existing, afterJson: updated, ipAddress: requestIp(request) })
    return reply.send(updated)
  })

  app.delete('/api/deputy-managers/:id', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const params = request.params as { id: string }
    const existing = await prisma.deputyManager.findUnique({ where: { id: params.id }, include: { crewManagers: true, person: true } })
    if (!existing) return notFound(reply, 'Deputy manager not found')
    if (existing.crewManagers.length) return badRequest(reply, 'Move or delete crew managers before deleting this deputy manager')
    await prisma.deputyManager.delete({ where: { id: existing.id } })
    await writeAuditLog({ userId: user.id, action: 'deputyManager.delete', entityType: 'DeputyManager', entityId: existing.id, beforeJson: existing, ipAddress: requestIp(request) })
    return noContent(reply)
  })

  app.post('/api/crew-managers', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const parsed = personSchema.extend({
      deputyManagerId: z.string().min(1),
      deputyManagerReportingLineId: z.string().min(1).optional(),
    }).safeParse(request.body)
    if (!parsed.success) return badRequest(reply, 'Invalid crew manager payload', parsed.error.flatten())
    if (parsed.data.workflowRole !== 'CREW_MANAGER') return badRequest(reply, 'workflowRole must be CREW_MANAGER')
    const org = await getPrimaryOrganization()
    if (!org) return notFound(reply, 'Organization not configured')
    const parent = await prisma.deputyManager.findUnique({ where: { id: parsed.data.deputyManagerId } })
    if (!parent) return notFound(reply, 'Deputy manager not found')
    const createdManager = await prisma.$transaction(async (tx) => {
      const person = await tx.person.create({ data: { organizationId: org.id, name: parsed.data.name, designation: parsed.data.designation, workflowRole: 'CREW_MANAGER', email: parsed.data.email || null, phone: parsed.data.phone || null, notes: parsed.data.notes || null } })
      const manager = await tx.crewManager.create({ data: { organizationId: org.id, deputyManagerId: parent.id, personId: person.id, sortOrder: parsed.data.sortOrder ?? 0 }, include: { person: true } })
      const parentPlacement = parsed.data.deputyManagerReportingLineId
        ? await tx.deputyManagerReportingLine.findUnique({ where: { id: parsed.data.deputyManagerReportingLineId } })
        : await tx.deputyManagerReportingLine.findFirst({ where: { deputyManagerId: parent.id, isPrimary: true } })
      if (!parentPlacement || parentPlacement.deputyManagerId !== parent.id || parentPlacement.organizationId !== org.id) {
        throw new Error('Selected Deputy Manager placement is missing')
      }
      await tx.crewManagerReportingLine.create({
        data: {
          organizationId: org.id,
          crewManagerId: manager.id,
          deputyManagerId: parent.id,
          deputyManagerReportingLineId: parentPlacement.id,
          isPrimary: true,
        },
      })
      return manager
    })
    await writeAuditLog({ userId: user.id, action: 'crewManager.create', entityType: 'CrewManager', entityId: createdManager.id, afterJson: createdManager, ipAddress: requestIp(request) })
    return created(reply, createdManager)
  })

  app.patch('/api/crew-managers/:id', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const parsed = personSchema.partial().extend({ deputyManagerId: z.string().min(1).optional() }).safeParse(request.body)
    if (!parsed.success) return badRequest(reply, 'Invalid crew manager payload', parsed.error.flatten())
    const params = request.params as { id: string }
    const existing = await prisma.crewManager.findUnique({ where: { id: params.id }, include: { person: true, vesselAllocations: true, reportingLines: true } })
    if (!existing) return notFound(reply, 'Crew manager not found')
    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.deputyManagerId && parsed.data.deputyManagerId !== existing.deputyManagerId) {
        const parentPlacement = await tx.deputyManagerReportingLine.findFirst({
          where: { deputyManagerId: parsed.data.deputyManagerId, isPrimary: true },
        })
        if (!parentPlacement) throw new Error('Primary Deputy Manager placement is missing')
        await tx.crewManager.update({ where: { id: existing.id }, data: { deputyManagerId: parsed.data.deputyManagerId } })
        const primaryLine = existing.reportingLines.find((line) => line.isPrimary) ?? existing.reportingLines[0]
        if (primaryLine) {
          await tx.crewManagerReportingLine.update({
            where: { id: primaryLine.id },
            data: {
              deputyManagerId: parsed.data.deputyManagerId,
              deputyManagerReportingLineId: parentPlacement.id,
              isPrimary: true,
            },
          })
        } else {
          await tx.crewManagerReportingLine.create({
            data: {
              organizationId: existing.organizationId,
              crewManagerId: existing.id,
              deputyManagerId: parsed.data.deputyManagerId,
              deputyManagerReportingLineId: parentPlacement.id,
              isPrimary: true,
            },
          })
        }
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
      if (parsed.data.sortOrder !== undefined) {
        await tx.crewManager.update({ where: { id: existing.id }, data: { sortOrder: parsed.data.sortOrder } })
      }
      return tx.crewManager.findUnique({ where: { id: existing.id }, include: { person: true, vesselAllocations: true } })
    })
    if (!updated) return notFound(reply, 'Crew manager not found')
    await writeAuditLog({ userId: user.id, action: 'crewManager.update', entityType: 'CrewManager', entityId: updated.id, beforeJson: existing, afterJson: updated, ipAddress: requestIp(request) })
    return reply.send(updated)
  })

  app.delete('/api/crew-managers/:id', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const params = request.params as { id: string }
    const existing = await prisma.crewManager.findUnique({ where: { id: params.id }, include: { vesselAllocations: true, person: true } })
    if (!existing) return notFound(reply, 'Crew manager not found')
    if (existing.vesselAllocations.length) {
      return badRequest(reply, 'Clear vessel allocations before deleting this crew manager')
    }
    await prisma.crewManager.delete({ where: { id: existing.id } })
    await writeAuditLog({ userId: user.id, action: 'crewManager.delete', entityType: 'CrewManager', entityId: existing.id, beforeJson: existing, ipAddress: requestIp(request) })
    return noContent(reply)
  })

  app.post('/api/assistants', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    return badRequest(reply, 'Assistants are no longer part of the active hierarchy. Use Deputy Managers and Crew Managers instead.')
  })

  app.patch('/api/assistants/:id', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    return badRequest(reply, 'Assistants are no longer part of the active hierarchy. Use Deputy Managers and Crew Managers instead.')
  })

  app.delete('/api/assistants/:id', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    return badRequest(reply, 'Assistants are no longer part of the active hierarchy. Use Deputy Managers and Crew Managers instead.')
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
    if (!parsed.success) return badRequest(reply, firstZodMessage(parsed.error, 'Invalid vessel payload'), parsed.error.flatten())
    const org = await getPrimaryOrganization()
    if (!org) return notFound(reply, 'Organization not configured')
    const crewManager = await prisma.crewManager.findUnique({ where: { id: parsed.data.crewManagerId } })
    if (!crewManager) return notFound(reply, 'Crew manager not found')
    const reportingLine = await resolveCrewManagerReportingLine(org.id, crewManager.id, parsed.data.crewManagerReportingLineId)
    if (!reportingLine) return badRequest(reply, 'Select a valid Crew Manager reporting path.')
    const createdVessel = await prisma.$transaction(async (tx) => {
      const vessel = await tx.vessel.create({
        data: {
          organizationId: org.id,
          name: parsed.data.name,
          vesselType: parsed.data.vesselType,
          vesselDoc: parsed.data.vesselDoc || null,
          deadweightTonnage: parsed.data.deadweightTonnage || null,
          ownerPool: parsed.data.ownerPool || null,
          ownerName: parsed.data.ownerName || null,
          marineSuperintendent: parsed.data.marineSuperintendent || null,
          vesselManager: parsed.data.vesselManager || null,
          takeoverDate: toNullableDate(parsed.data.takeoverDate),
          handoverDate: toNullableDate(parsed.data.handoverDate),
          vesselStatus: parsed.data.vesselStatus,
          managementType: parsed.data.managementType,
          notes: parsed.data.notes || null,
          sortOrder: parsed.data.sortOrder ?? 0,
        },
      })
      await tx.vesselAllocation.upsert({
        where: { vesselId: vessel.id },
        create: {
          vesselId: vessel.id,
          crewManagerId: crewManager.id,
          crewManagerReportingLineId: reportingLine.id,
          assignedAssistantId: null,
          allocatedAt: new Date(),
        },
        update: {
          crewManagerId: crewManager.id,
          crewManagerReportingLineId: reportingLine.id,
          assignedAssistantId: null,
          allocatedAt: new Date(),
        },
      })
      return vessel
    })
    await writeAuditLog({ userId: user.id, action: 'vessel.create', entityType: 'Vessel', entityId: createdVessel.id, afterJson: createdVessel, ipAddress: requestIp(request) })
    return created(reply, createdVessel)
  })

  app.patch('/api/vessels/:id', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const parsed = vesselSchema.partial().safeParse(request.body)
    if (!parsed.success) return badRequest(reply, firstZodMessage(parsed.error, 'Invalid vessel payload'), parsed.error.flatten())
    const params = request.params as { id: string }
    const existing = await prisma.vessel.findUnique({ where: { id: params.id }, include: { vesselAllocations: { take: 1, orderBy: { allocatedAt: 'desc' } } } })
    if (!existing) return notFound(reply, 'Vessel not found')
    const targetCrewManagerId = parsed.data.crewManagerId
    const crewManager = targetCrewManagerId
      ? await prisma.crewManager.findUnique({ where: { id: targetCrewManagerId } })
      : null
    if (targetCrewManagerId && !crewManager) return notFound(reply, 'Crew manager not found')
    const currentAllocation = existing.vesselAllocations[0]
    const resolvedCrewManagerId = targetCrewManagerId || currentAllocation?.crewManagerId
    const reportingLine = resolvedCrewManagerId && (targetCrewManagerId || parsed.data.crewManagerReportingLineId)
      ? await resolveCrewManagerReportingLine(
          existing.organizationId,
          resolvedCrewManagerId,
          parsed.data.crewManagerReportingLineId || currentAllocation?.crewManagerReportingLineId,
        )
      : null
    if (resolvedCrewManagerId && (targetCrewManagerId || parsed.data.crewManagerReportingLineId) && !reportingLine) {
      return badRequest(reply, 'Select a valid Crew Manager reporting path.')
    }
    const updated = await prisma.$transaction(async (tx) => {
      const vessel = await tx.vessel.update({
        where: { id: existing.id },
        data: {
          name: parsed.data.name,
          vesselType: parsed.data.vesselType,
          vesselDoc: parsed.data.vesselDoc,
          deadweightTonnage: parsed.data.deadweightTonnage,
          ownerPool: parsed.data.ownerPool,
          ownerName: parsed.data.ownerName,
          marineSuperintendent: parsed.data.marineSuperintendent,
          vesselManager: parsed.data.vesselManager,
          takeoverDate: parsed.data.takeoverDate !== undefined ? toNullableDate(parsed.data.takeoverDate) : undefined,
          handoverDate: parsed.data.handoverDate !== undefined ? toNullableDate(parsed.data.handoverDate) : undefined,
          vesselStatus: parsed.data.vesselStatus,
          managementType: parsed.data.managementType,
          notes: parsed.data.notes,
          sortOrder: parsed.data.sortOrder,
        } as Prisma.VesselUpdateInput,
      })
      if (crewManager) {
        await tx.vesselAllocation.upsert({
          where: { vesselId: vessel.id },
          create: {
            vesselId: vessel.id,
            crewManagerId: crewManager.id,
            crewManagerReportingLineId: reportingLine!.id,
            assignedAssistantId: null,
            allocatedAt: new Date(),
          },
          update: {
            crewManagerId: crewManager.id,
            crewManagerReportingLineId: reportingLine!.id,
            assignedAssistantId: null,
            allocatedAt: new Date(),
          },
        })
      }
      return vessel
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
    if (!parsed.success) return badRequest(reply, firstZodMessage(parsed.error, 'Invalid allocation payload'), parsed.error.flatten())
    const params = request.params as { id: string }
    const vessel = await prisma.vessel.findUnique({ where: { id: params.id } })
    if (!vessel) return notFound(reply, 'Vessel not found')
    const crewManager = await prisma.crewManager.findUnique({ where: { id: parsed.data.crewManagerId } })
    if (!crewManager) return notFound(reply, 'Crew manager not found')
    const reportingLine = await resolveCrewManagerReportingLine(vessel.organizationId, crewManager.id, parsed.data.crewManagerReportingLineId)
    if (!reportingLine) return badRequest(reply, 'Select a valid Crew Manager reporting path.')
    const before = await prisma.vesselAllocation.findUnique({ where: { vesselId: vessel.id } })
    const allocation = await prisma.vesselAllocation.upsert({
      where: { vesselId: vessel.id },
      create: {
        vesselId: vessel.id,
        crewManagerId: crewManager.id,
        crewManagerReportingLineId: reportingLine.id,
        assignedAssistantId: null,
        allocatedAt: new Date(),
      },
      update: {
        crewManagerId: crewManager.id,
        crewManagerReportingLineId: reportingLine.id,
        assignedAssistantId: null,
        allocatedAt: new Date(),
      },
    })
    await writeAuditLog({ userId: user.id, action: 'vessel.allocation.update', entityType: 'VesselAllocation', entityId: allocation.id, beforeJson: before, afterJson: allocation, ipAddress: requestIp(request) })
    return reply.send(allocation)
  })

  app.delete('/api/vessels/:id/allocation', async (request, reply) => {
    const user = await ensureAuthorizedWrite(request, reply)
    if (!user) return
    const params = request.params as { id: string }
    const vessel = await prisma.vessel.findUnique({ where: { id: params.id } })
    if (!vessel) return notFound(reply, 'Vessel not found')
    const before = await prisma.vesselAllocation.findUnique({ where: { vesselId: vessel.id } })
    if (before) {
      await prisma.vesselAllocation.delete({ where: { vesselId: vessel.id } })
      await writeAuditLog({ userId: user.id, action: 'vessel.allocation.remove', entityType: 'VesselAllocation', entityId: before.id, beforeJson: before, ipAddress: requestIp(request) })
    }
    return reply.send({ success: true })
  })

  app.get('/api/reports/summary', async (request, reply) => {
    const user = await requireCurrentUser(request, reply)
    if (!user) return
    const org = await getPrimaryOrganization()
    if (!org) return reply.send({ organization: null, counts: { crewDirectors: 0, operationsManagers: 0, deputyManagers: 0, crewManagers: 0, vessels: 0 } })
    const [crewDirectors, operationsManagers, deputyManagers, crewManagers, vessels] = await Promise.all([
      prisma.crewDirector.count({ where: { organizationId: org.id } }),
      prisma.operationsManager.count({ where: { organizationId: org.id } }),
      prisma.deputyManager.count({ where: { organizationId: org.id } }),
      prisma.crewManager.count({ where: { organizationId: org.id } }),
      prisma.vessel.count({ where: { organizationId: org.id } }),
    ])
    return reply.send({ organization: org, counts: { crewDirectors, operationsManagers, deputyManagers, crewManagers, vessels } })
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
