import type { FastifyRequest } from 'fastify'
import { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma.js'
import { entitySnapshot } from '../utils/parse.js'

type AuditInput = {
  userId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  beforeJson?: unknown
  afterJson?: unknown
  ipAddress?: string | null
}

export async function writeAuditLog(input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      beforeJson: input.beforeJson == null ? Prisma.JsonNull : (entitySnapshot(input.beforeJson) as Prisma.InputJsonValue),
      afterJson: input.afterJson == null ? Prisma.JsonNull : (entitySnapshot(input.afterJson) as Prisma.InputJsonValue),
      ipAddress: input.ipAddress ?? null,
    },
  })
}

export function requestIp(request: FastifyRequest) {
  return request.ip || null
}
