import { prisma } from '../db/prisma.js'

export async function getOrganizationHierarchy(organizationId: string) {
  const [organization, crewDirectors, operationsManagers, crewManagers, assistants, allocations] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId } }),
    prisma.crewDirector.findMany({ where: { organizationId }, orderBy: { sortOrder: 'asc' }, include: { person: true } }),
    prisma.operationsManager.findMany({ where: { organizationId }, orderBy: [{ crewDirectorId: 'asc' }, { sortOrder: 'asc' }], include: { person: true } }),
    prisma.crewManager.findMany({ where: { organizationId }, orderBy: { sortOrder: 'asc' }, include: { person: true } }),
    prisma.assistant.findMany({ where: { organizationId }, orderBy: { sortOrder: 'asc' }, include: { person: true } }),
    prisma.vesselAllocation.findMany({ where: { vessel: { organizationId } }, include: { vessel: true, crewManager: { include: { person: true } }, assignedAssistant: { include: { person: true } } } }),
  ])

  const assistantsByCrewManager = new Map<string, typeof assistants>()
  for (const assistant of assistants) {
    const crewManager = await prisma.crewManager.findFirst({ where: { id: assistant.crewManagerId } })
    if (!crewManager) continue
    const list = assistantsByCrewManager.get(crewManager.id) ?? []
    list.push(assistant)
    assistantsByCrewManager.set(crewManager.id, list)
  }

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
          crewManagers: crewManagers
            .filter((cm) => cm.operationsManagerId === op.id)
            .map((cm) => ({
              id: cm.id,
              person: cm.person,
              assistants: assistantsByCrewManager.get(cm.id) ?? [],
              vessels: vesselsByCrewManager.get(cm.id) ?? [],
            })),
        })),
    })),
  }
}
