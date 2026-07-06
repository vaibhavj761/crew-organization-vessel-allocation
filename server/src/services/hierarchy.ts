import { prisma } from '../db/prisma.js'

export async function getOrganizationHierarchy(organizationId: string) {
  const [organization, crewDirector, operationsManagers, crewManagers, assistants, allocations] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId } }),
    prisma.person.findFirst({ where: { organizationId, workflowRole: 'CREW_DIRECTOR' } }),
    prisma.operationsManager.findMany({ where: { organizationId }, orderBy: { sortOrder: 'asc' }, include: { person: true } }),
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
    crewDirector,
    operationsManagers: operationsManagers.map((op) => ({
      id: op.id,
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
  }
}
