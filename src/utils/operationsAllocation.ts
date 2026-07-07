import type { ChartData, CrewManagerNode, OperationsManagerNode } from '../types'

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
  if (!crewManagerId) return operationsManager.crewManagers
  return operationsManager.crewManagers.filter((item) => item.id === crewManagerId)
}
