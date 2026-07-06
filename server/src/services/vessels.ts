import { prisma } from '../db/prisma.js'

export async function listVesselsWithAllocation(organizationId: string) {
  const vessels = await prisma.vessel.findMany({
    where: { organizationId },
    orderBy: { sortOrder: 'asc' },
    include: {
      vesselAllocations: {
        orderBy: { allocatedAt: 'desc' },
        take: 1,
        include: {
          crewManager: { include: { person: true } },
          assignedAssistant: { include: { person: true } },
        },
      },
    },
  })

  return vessels.map((vessel) => {
    const allocation = vessel.vesselAllocations[0] ?? null
    return {
      ...vessel,
      currentAllocation: allocation
        ? {
            id: allocation.id,
            crewManagerId: allocation.crewManagerId,
            crewManager: allocation.crewManager,
            assignedAssistantId: allocation.assignedAssistantId,
            assignedAssistant: allocation.assignedAssistant,
            allocatedAt: allocation.allocatedAt,
          }
        : null,
    }
  })
}
