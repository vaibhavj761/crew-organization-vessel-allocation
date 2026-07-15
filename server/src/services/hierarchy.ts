import { prisma } from '../db/prisma.js'

export async function getOrganizationHierarchy(organizationId: string) {
  const [organization, crewDirectors, operationsManagers, deputyManagers, crewManagers, allocations] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId } }),
    prisma.crewDirector.findMany({ where: { organizationId }, orderBy: { sortOrder: 'asc' }, include: { person: true } }),
    prisma.operationsManager.findMany({ where: { organizationId }, orderBy: [{ crewDirectorId: 'asc' }, { sortOrder: 'asc' }], include: { person: true } }),
    prisma.deputyManager.findMany({ where: { organizationId }, orderBy: [{ operationsManagerId: 'asc' }, { sortOrder: 'asc' }], include: { person: true } }),
    prisma.crewManager.findMany({ where: { organizationId }, orderBy: { sortOrder: 'asc' }, include: { person: true } }),
    prisma.vesselAllocation.findMany({ where: { vessel: { organizationId } }, include: { vessel: true, crewManager: { include: { person: true } } } }),
  ])

  const vesselsByCrewManager = new Map<string, Array<{ id: string; name: string }>>()
  for (const allocation of allocations) {
    const list = vesselsByCrewManager.get(allocation.crewManagerId) ?? []
    list.push(allocation.vessel)
    vesselsByCrewManager.set(allocation.crewManagerId, list)
  }

  return {
    organization,
    crewDirectors: crewDirectors.map((director) => ({
      id: director.id,
      person: director.person,
      operationsManagers: operationsManagers
        .filter((op) => op.crewDirectorId === director.id)
        .map((op) => ({
          id: op.id,
          crewDirectorId: director.id,
          person: op.person,
          deputyManagers: deputyManagers
            .filter((deputy) => deputy.operationsManagerId === op.id)
            .map((deputy) => ({
              id: deputy.id,
              operationsManagerId: op.id,
              person: deputy.person,
              crewManagers: crewManagers
                .filter((cm) => cm.deputyManagerId === deputy.id)
                .map((cm) => ({
                  id: cm.id,
                  person: cm.person,
                  vessels: vesselsByCrewManager.get(cm.id) ?? [],
                })),
            })),
        })),
    })),
  }
}
