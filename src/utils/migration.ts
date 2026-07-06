import type { ChartData, Person, Vessel } from '../types'

type LegacyPerson = Omit<Person, 'workflowRole'>
interface LegacyData { schemaVersion: 1; title: string; organizationName: string; effectiveDate: string; head: LegacyPerson; crewOperationsManager: LegacyPerson; crewManagerTeams: Array<{ id: string; sortOrder: number; manager: LegacyPerson; assistants: Array<LegacyPerson & { sortOrder: number }>; vessels: Array<{ id:string; name:string; vesselType:string; fleet:string; status:string; assignedAssistantId:string; notes:string; sortOrder:number }> }>; footerText: string }

export function migrateV1ToV2(old: LegacyData): ChartData {
  const opNodeId = `ops-node-${old.crewOperationsManager.id}`
  const vessels: Vessel[] = old.crewManagerTeams.flatMap((team) => team.vessels.map((v) => ({ id:v.id, name:v.name, vesselType:v.vesselType, vesselDoc:'', deadweightTonnage:'', ownerPool:v.fleet, ownerName:'', vesselManager:'', crewManagerId:team.manager.id, assignedAssistantId:v.assignedAssistantId, vesselStatus: v.status.toLowerCase().includes('upcoming') ? 'UPCOMING' : v.status.toLowerCase().includes('out') ? 'OUT_OF_MANAGEMENT' : 'IN_MANAGEMENT', managementType:'FULL_MANAGED', notes:v.notes, sortOrder:v.sortOrder })))
  return {
    schemaVersion:2, title: old.title || 'Crew Organization and Vessel Allocation Planner', organizationName:old.organizationName, effectiveDate:old.effectiveDate,
    crewDirector:{...old.head, workflowRole:'CREW_DIRECTOR'},
    operationsManagers:[{ id:opNodeId, sortOrder:1, person:{...old.crewOperationsManager, workflowRole:'OPERATIONS_MANAGER'}, crewManagers:old.crewManagerTeams.map((team) => ({ id:team.id, sortOrder:team.sortOrder, person:{...team.manager, workflowRole:'CREW_MANAGER'}, assistants:team.assistants.map((a) => ({...a, workflowRole:'ASSISTANT'})), vesselIds:team.vessels.map((v)=>v.id) })) }],
    vessels, footerText:old.footerText,
  }
}

export function migrateChartData(input: unknown): unknown {
  if (input && typeof input === 'object' && 'schemaVersion' in input && input.schemaVersion === 1) return migrateV1ToV2(input as LegacyData)
  return input
}
