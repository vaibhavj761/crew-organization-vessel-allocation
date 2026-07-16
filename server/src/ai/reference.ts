import { createHash } from 'node:crypto'
import { prisma } from '../db/prisma.js'

export type AiReferenceData = Awaited<ReturnType<typeof getAiReferenceData>>

export async function getPrimaryOrganization() {
  return prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } })
}

export async function getAiReferenceData() {
  const organization = await getPrimaryOrganization()
  if (!organization) {
    return {
      organization: null,
      crewDirectors: [],
      operationsManagers: [],
      deputyManagers: [],
      crewManagers: [],
      assistants: [],
      vessels: [],
    }
  }

  const [crewDirectors, operationsManagers, deputyManagers, crewManagers, assistants, vessels] = await Promise.all([
    prisma.crewDirector.findMany({ where: { organizationId: organization.id }, include: { person: true, operationsManagers: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.operationsManager.findMany({ where: { organizationId: organization.id }, include: { person: true, deputyManagers: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.deputyManager.findMany({ where: { organizationId: organization.id }, include: { person: true, crewManagers: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.crewManager.findMany({ where: { organizationId: organization.id }, include: { person: true, vesselAllocations: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.assistant.findMany({ where: { organizationId: organization.id }, include: { person: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.vessel.findMany({ where: { organizationId: organization.id }, include: { vesselAllocations: true }, orderBy: { sortOrder: 'asc' } }),
  ])

  return { organization, crewDirectors, operationsManagers, deputyManagers, crewManagers, assistants, vessels }
}

export function referenceHash(reference: AiReferenceData) {
  const stable = {
    organizationId: reference.organization?.id || null,
    crewDirectors: reference.crewDirectors.map((item) => ({ id: item.id, name: item.person.name, designation: item.person.designation, personUpdatedAt: item.person.updatedAt.toISOString(), updatedAt: item.updatedAt.toISOString() })),
    operationsManagers: reference.operationsManagers.map((item) => ({ id: item.id, parentId: item.crewDirectorId, name: item.person.name, designation: item.person.designation, personUpdatedAt: item.person.updatedAt.toISOString(), updatedAt: item.updatedAt.toISOString() })),
    deputyManagers: reference.deputyManagers.map((item) => ({ id: item.id, parentId: item.operationsManagerId, name: item.person.name, designation: item.person.designation, personUpdatedAt: item.person.updatedAt.toISOString(), updatedAt: item.updatedAt.toISOString(), crewManagers: item.crewManagers.length })),
    crewManagers: reference.crewManagers.map((item) => ({ id: item.id, parentId: item.deputyManagerId, name: item.person.name, designation: item.person.designation, personUpdatedAt: item.person.updatedAt.toISOString(), updatedAt: item.updatedAt.toISOString(), vessels: item.vesselAllocations.length })),
    assistants: reference.assistants.map((item) => ({ id: item.id, parentId: item.crewManagerId, name: item.person.name, designation: item.person.designation, personUpdatedAt: item.person.updatedAt.toISOString(), updatedAt: item.updatedAt.toISOString() })),
    vessels: reference.vessels.map((item) => ({ id: item.id, name: item.name, vesselType: item.vesselType, updatedAt: item.updatedAt.toISOString(), allocations: item.vesselAllocations.map((allocation) => ({ crewManagerId: allocation.crewManagerId, assistantId: allocation.assignedAssistantId })) })),
  }
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex')
}

export function compactReferenceForAi(reference: AiReferenceData) {
  const directorById = new Map(reference.crewDirectors.map((item) => [item.id, item.person.name]))
  const operationsById = new Map(reference.operationsManagers.map((item) => [item.id, item.person.name]))
  const deputyById = new Map(reference.deputyManagers.map((item) => [item.id, item.person.name]))
  const crewManagerById = new Map(reference.crewManagers.map((item) => [item.id, item.person.name]))
  return {
    crewDirectors: reference.crewDirectors.map((item) => ({ id: item.id, name: item.person.name })),
    crewOperationsManagers: reference.operationsManagers.map((item) => ({ id: item.id, name: item.person.name, parentCrewDirectorName: directorById.get(item.crewDirectorId) || null })),
    deputyManagers: reference.deputyManagers.map((item) => ({ id: item.id, name: item.person.name, parentCrewOperationsManagerName: operationsById.get(item.operationsManagerId) || null })),
    crewManagers: reference.crewManagers.map((item) => ({ id: item.id, name: item.person.name, parentDeputyManagerName: deputyById.get(item.deputyManagerId) || null })),
    assistants: reference.assistants.map((item) => ({ id: item.id, name: item.person.name, parentCrewManagerName: crewManagerById.get(item.crewManagerId) || null })),
    vessels: reference.vessels.map((item) => {
      const allocation = item.vesselAllocations[0]
      return {
        id: item.id,
        name: item.name,
        vesselType: item.vesselType,
        assignedCrewManagerName: allocation?.crewManagerId ? crewManagerById.get(allocation.crewManagerId) || null : null,
      }
    }),
    allowedVesselTypes: Array.from(new Set(reference.vessels.map((item) => item.vesselType).filter(Boolean))).sort(),
  }
}
