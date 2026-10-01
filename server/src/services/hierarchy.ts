import { prisma } from '../db/prisma.js'

export async function getOrganizationHierarchy(organizationId: string) {
  const [organization, crewDirectors, operationsManagers, deputyManagers, crewManagers, allocations, operationsLines, deputyLines, crewLines, managementPositions] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId } }),
    prisma.crewDirector.findMany({ where: { organizationId }, orderBy: { sortOrder: 'asc' }, include: { person: true } }),
    prisma.operationsManager.findMany({ where: { organizationId }, orderBy: { sortOrder: 'asc' }, include: { person: true } }),
    prisma.deputyManager.findMany({ where: { organizationId }, orderBy: { sortOrder: 'asc' }, include: { person: true } }),
    prisma.crewManager.findMany({ where: { organizationId }, orderBy: { sortOrder: 'asc' }, include: { person: true } }),
    prisma.vesselAllocation.findMany({ where: { vessel: { organizationId } }, include: { vessel: true } }),
    prisma.operationsManagerReportingLine.findMany({ where: { organizationId }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] }),
    prisma.deputyManagerReportingLine.findMany({ where: { organizationId }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] }),
    prisma.crewManagerReportingLine.findMany({ where: { organizationId }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] }),
    prisma.managementHierarchyPosition.findMany({
      where: { organizationId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { person: true, level: true },
    }),
  ])

  const operationsById = new Map(operationsManagers.map((manager) => [manager.id, manager]))
  const deputiesById = new Map(deputyManagers.map((manager) => [manager.id, manager]))
  const crewById = new Map(crewManagers.map((manager) => [manager.id, manager]))
  const operationsLinesByDirector = new Map<string, typeof operationsLines>()
  const deputyLinesByOperationsPlacement = new Map<string, typeof deputyLines>()
  const crewLinesByDeputyPlacement = new Map<string, typeof crewLines>()
  const positionsByDirector = new Map<string, typeof managementPositions>()
  for (const line of operationsLines) {
    const list = operationsLinesByDirector.get(line.crewDirectorId) ?? []
    list.push(line)
    operationsLinesByDirector.set(line.crewDirectorId, list)
  }
  for (const line of deputyLines) {
    const list = deputyLinesByOperationsPlacement.get(line.operationsManagerReportingLineId) ?? []
    list.push(line)
    deputyLinesByOperationsPlacement.set(line.operationsManagerReportingLineId, list)
  }
  for (const line of crewLines) {
    const list = crewLinesByDeputyPlacement.get(line.deputyManagerReportingLineId) ?? []
    list.push(line)
    crewLinesByDeputyPlacement.set(line.deputyManagerReportingLineId, list)
  }
  for (const position of managementPositions) {
    const list = positionsByDirector.get(position.crewDirectorId) ?? []
    list.push(position)
    positionsByDirector.set(position.crewDirectorId, list)
  }
  const vesselsByCrewManagerPlacement = new Map<string, Array<{ id: string; name: string }>>()
  for (const allocation of allocations) {
    const list = vesselsByCrewManagerPlacement.get(allocation.crewManagerReportingLineId) ?? []
    list.push(allocation.vessel)
    vesselsByCrewManagerPlacement.set(allocation.crewManagerReportingLineId, list)
  }

  const crewDirectorIdsByOperationsManager = new Map<string, string[]>()
  for (const line of operationsLines) {
    const parentIds = crewDirectorIdsByOperationsManager.get(line.operationsManagerId) ?? []
    parentIds.push(line.crewDirectorId)
    crewDirectorIdsByOperationsManager.set(line.operationsManagerId, parentIds)
  }
  const operationsManagerIdsByDeputy = new Map<string, string[]>()
  for (const line of deputyLines) {
    const parentIds = operationsManagerIdsByDeputy.get(line.deputyManagerId) ?? []
    if (!parentIds.includes(line.operationsManagerId)) parentIds.push(line.operationsManagerId)
    operationsManagerIdsByDeputy.set(line.deputyManagerId, parentIds)
  }
  const deputyManagerIdsByCrewManager = new Map<string, string[]>()
  for (const line of crewLines) {
    const parentIds = deputyManagerIdsByCrewManager.get(line.crewManagerId) ?? []
    if (!parentIds.includes(line.deputyManagerId)) parentIds.push(line.deputyManagerId)
    deputyManagerIdsByCrewManager.set(line.crewManagerId, parentIds)
  }

  return {
    organization,
    crewDirectors: crewDirectors.map((director) => ({
      id: director.id,
      person: director.person,
      managementPositions: (positionsByDirector.get(director.id) ?? []).map((position) => ({
        id: position.id,
        crewDirectorId: position.crewDirectorId,
        parentPositionId: position.parentPositionId,
        levelId: position.levelId,
        levelName: position.level.name,
        sortOrder: position.sortOrder,
        person: position.person,
      })),
      operationsManagers: (operationsLinesByDirector.get(director.id) ?? [])
        .map((operationsLine) => {
          const operationsManager = operationsById.get(operationsLine.operationsManagerId)
          if (!operationsManager) return null
          return {
            id: operationsManager.id,
            reportingLineId: operationsLine.id,
            isPrimaryReportingLine: operationsLine.isPrimary,
            managementHierarchyPositionId: operationsLine.managementHierarchyPositionId,
            crewDirectorId: director.id,
            primaryCrewDirectorId: operationsManager.crewDirectorId,
            crewDirectorIds: crewDirectorIdsByOperationsManager.get(operationsManager.id) ?? [operationsManager.crewDirectorId],
            person: operationsManager.person,
            deputyManagers: (deputyLinesByOperationsPlacement.get(operationsLine.id) ?? [])
              .map((deputyLine) => {
                const deputyManager = deputiesById.get(deputyLine.deputyManagerId)
                if (!deputyManager) return null
                return {
                  id: deputyManager.id,
                  reportingLineId: deputyLine.id,
                  isPrimaryReportingLine: deputyLine.isPrimary,
                  operationsManagerId: operationsManager.id,
                  primaryOperationsManagerId: deputyManager.operationsManagerId,
                  operationsManagerIds: operationsManagerIdsByDeputy.get(deputyManager.id) ?? [deputyManager.operationsManagerId],
                  person: deputyManager.person,
                  crewManagers: (crewLinesByDeputyPlacement.get(deputyLine.id) ?? [])
                    .map((crewLine) => {
                      const crewManager = crewById.get(crewLine.crewManagerId)
                      if (!crewManager) return null
                      return {
                        id: crewManager.id,
                        reportingLineId: crewLine.id,
                        isPrimaryReportingLine: crewLine.isPrimary,
                        deputyManagerId: deputyManager.id,
                        primaryDeputyManagerId: crewManager.deputyManagerId,
                        deputyManagerIds: deputyManagerIdsByCrewManager.get(crewManager.id) ?? [crewManager.deputyManagerId],
                        person: crewManager.person,
                        // A vessel belongs to one exact reporting placement. The
                        // same Crew Manager may appear elsewhere without cloning
                        // this vessel or inflating the parent totals.
                        vessels: vesselsByCrewManagerPlacement.get(crewLine.id) ?? [],
                      }
                    })
                    .filter((manager): manager is NonNullable<typeof manager> => Boolean(manager)),
                }
              })
              .filter((manager): manager is NonNullable<typeof manager> => Boolean(manager)),
          }
        })
        .filter((manager): manager is NonNullable<typeof manager> => Boolean(manager)),
    })),
  }
}
