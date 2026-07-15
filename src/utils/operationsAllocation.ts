import type { ChartData, CrewManagerNode, DeputyManagerNode, OperationsManagerNode } from '../types'

export function getVesselColumnCount(count: number) {
  if (count <= 8) return 1
  if (count <= 16) return 2
  return 3
}

export function getOperationsManagersForDirector(data: ChartData, directorId: string) {
  return data.operationsManagers.filter((item) => item.crewDirectorId === directorId)
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
  return data.operationsManagers.flatMap((op) => op.deputyManagers.flatMap((deputy) => deputy.crewManagers))
}

export function getAllDeputyManagers(data: ChartData) {
  return data.operationsManagers.flatMap((op) => op.deputyManagers)
}
