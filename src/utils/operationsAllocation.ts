import type { ChartData, CrewManagerNode, DeputyManagerNode, ManagementHierarchyPositionNode, OperationsManagerNode, Vessel } from '../types'

export interface CrewManagerPlacement {
  crewManager: CrewManagerNode
  deputyManager: DeputyManagerNode
  operationsManager: OperationsManagerNode
}

export function getVesselColumnCount(count: number) {
  if (count <= 8) return 1
  if (count <= 16) return 2
  return 3
}

export function getOperationsManagersForDirector(data: ChartData, directorId: string) {
  return data.operationsManagers.filter((item) => item.crewDirectorId === directorId)
}

export function getManagementPositionDescendantIds(positions: ManagementHierarchyPositionNode[], positionId: string) {
  const children = new Map<string, string[]>()
  positions.forEach((position) => {
    const siblings = children.get(position.parentPositionId) || []
    siblings.push(position.id)
    children.set(position.parentPositionId, siblings)
  })
  const ids = new Set<string>()
  const pending = [positionId]
  while (pending.length) {
    const id = pending.shift()!
    if (ids.has(id)) continue
    ids.add(id)
    pending.push(...(children.get(id) || []))
  }
  return ids
}

export function getOperationsManagersForManagementPosition(data: ChartData, directorId: string, positionId = '') {
  const operationsManagers = getOperationsManagersForDirector(data, directorId)
  if (!positionId) return operationsManagers
  const director = data.crewDirectors.find((item) => item.id === directorId)
  const positionIds = getManagementPositionDescendantIds(director?.managementPositions || [], positionId)
  return operationsManagers.filter((item) => Boolean(item.managementHierarchyPositionId && positionIds.has(item.managementHierarchyPositionId)))
}

export function getManagementChainForOperationsManager(data: ChartData, operationsManager?: OperationsManagerNode) {
  if (!operationsManager?.managementHierarchyPositionId) return [] as ManagementHierarchyPositionNode[]
  const director = data.crewDirectors.find((item) => item.id === operationsManager.crewDirectorId)
  const positions = director?.managementPositions || []
  const byId = new Map(positions.map((position) => [position.id, position]))
  const chain: ManagementHierarchyPositionNode[] = []
  const visited = new Set<string>()
  let cursor = byId.get(operationsManager.managementHierarchyPositionId)
  while (cursor && !visited.has(cursor.id)) {
    chain.push(cursor)
    visited.add(cursor.id)
    cursor = cursor.parentPositionId ? byId.get(cursor.parentPositionId) : undefined
  }
  return chain.reverse()
}

export function getCrewManagersForOperationsManager(operationsManager?: OperationsManagerNode, crewManagerId = '') {
  if (!operationsManager) return [] as CrewManagerNode[]
  const crewManagers = operationsManager.deputyManagers.flatMap((deputy) => deputy.crewManagers)
  if (!crewManagerId) return crewManagers
  return crewManagers.filter((item) => item.id === crewManagerId)
}

export function getDeputyManagersForOperationsManager(operationsManager?: OperationsManagerNode, deputyManagerId = '') {
  if (!operationsManager) return [] as DeputyManagerNode[]
  if (!deputyManagerId) return operationsManager.deputyManagers
  return operationsManager.deputyManagers.filter((item) => item.id === deputyManagerId)
}

export function getAllCrewManagers(data: ChartData) {
  return Array.from(new Map(
    data.operationsManagers
      .flatMap((op) => op.deputyManagers.flatMap((deputy) => deputy.crewManagers))
      .map((manager) => [manager.id, manager]),
  ).values())
}

export function getAllDeputyManagers(data: ChartData) {
  return Array.from(new Map(
    data.operationsManagers.flatMap((op) => op.deputyManagers).map((manager) => [manager.id, manager]),
  ).values())
}

export function getCrewManagerReportingContext(data: ChartData, crewManagerId: string) {
  const operationNames = data.operationsManagers
    .filter((operation) => operation.deputyManagers.some((deputy) => deputy.crewManagers.some((manager) => manager.id === crewManagerId)))
    .map((operation) => operation.person.name)
  return Array.from(new Set(operationNames)).join(' / ')
}

export function getCrewManagerPlacements(data: ChartData, crewManagerId: string): CrewManagerPlacement[] {
  const placements = data.operationsManagers.flatMap((operationsManager) =>
    operationsManager.deputyManagers.flatMap((deputyManager) =>
      deputyManager.crewManagers
        .filter((crewManager) => crewManager.id === crewManagerId)
        .map((crewManager) => ({ crewManager, deputyManager, operationsManager })),
    ),
  )
  return Array.from(new Map(
    placements.map((placement) => [
      placement.crewManager.reportingLineId
        || `${placement.crewManager.id}:${placement.deputyManager.reportingLineId || placement.deputyManager.id}`,
      placement,
    ]),
  ).values())
}

export function getVesselPlacement(data: ChartData, vessel: Vessel) {
  const placements = getCrewManagerPlacements(data, vessel.crewManagerId)
  return placements.find((placement) =>
    vessel.crewManagerReportingLineId
      ? placement.crewManager.reportingLineId === vessel.crewManagerReportingLineId
      : placement.crewManager.isPrimaryReportingLine !== false,
  ) || placements[0]
}

export function vesselBelongsToCrewManagerPlacement(vessel: Vessel, crewManager: CrewManagerNode) {
  if (vessel.crewManagerReportingLineId && crewManager.reportingLineId) {
    return vessel.crewManagerReportingLineId === crewManager.reportingLineId
  }
  return crewManager.isPrimaryReportingLine !== false
    && (vessel.crewManagerId === crewManager.id || vessel.crewManagerId === crewManager.person.id)
}
