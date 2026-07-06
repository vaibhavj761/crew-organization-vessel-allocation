import type { Assistant, ChartData, CrewManagerNode, OperationsManagerNode, Person, Vessel } from '../types'

const person = <R extends Person['workflowRole']>(id: string, name: string, designation: string, workflowRole: R) => ({ id, name, designation, workflowRole, email: '', phone: '', notes: '' } as Person & { workflowRole: R })
const assistant = (id: string, name: string, designation: string, sortOrder: number): Assistant => ({ ...person(id, name, designation, 'ASSISTANT'), sortOrder })
const manager = (id: string, name: string, designation: string, sortOrder: number, assistants: Assistant[]): CrewManagerNode => ({ id: `team-${id}`, sortOrder, person: person(id, name, designation, 'CREW_MANAGER'), assistants, vesselIds: [] })
const ops = (id: string, name: string, designation: string, sortOrder: number, crewManagers: CrewManagerNode[]): OperationsManagerNode => ({ id: `ops-node-${id}`, sortOrder, person: person(id, name, designation, 'OPERATIONS_MANAGER'), crewManagers })
const vessel = (id: string, name: string, type: string, crewManagerId: string, assistantId: string, sortOrder: number): Vessel => ({ id, name, vesselType: type, vesselDoc: 'Northstar DOC', deadweightTonnage: '', ownerPool: 'Managed Pool', ownerName: '', vesselManager: 'Northstar Ship Management', crewManagerId, assignedAssistantId: assistantId, vesselStatus: 'IN_MANAGEMENT', managementType: 'FULL_MANAGED', notes: '', sortOrder })

const leena = manager('manager-1', 'Leena Thomas', 'Fleet Personnel Officer', 1, [assistant('assistant-1', 'Noor Khan', 'Assistant Crew Manager', 1), assistant('assistant-2', 'Rohan Das', 'Crewing Assistant', 2)])
const vikram = manager('manager-2', 'Vikram Menon', 'Senior Crewing Officer', 2, [assistant('assistant-3', 'Sara D’Souza', 'Assistant Crew Manager', 1)])
const elena = manager('manager-3', 'Elena George', 'Fleet Personnel Manager', 1, [assistant('assistant-4', 'Aman Pillai', 'Crewing Assistant', 1)])
leena.vesselIds = ['vessel-1', 'vessel-2', 'vessel-3']; vikram.vesselIds = ['vessel-4', 'vessel-5']; elena.vesselIds = ['vessel-6', 'vessel-7']

export const sampleData: ChartData = {
  schemaVersion: 2, title: 'Crew Organization and Vessel Allocation Planner', organizationName: 'Northstar Maritime Services', effectiveDate: '2026-07-01',
  crewDirector: { ...person('director-1', 'Anita Rao', 'Managing Director', 'CREW_DIRECTOR'), email: 'anita.rao@example.com' },
  operationsManagers: [ops('ops-1', 'Marcus Pereira', 'Crew Operations Manager', 1, [leena, vikram]), ops('ops-2', 'Priya Nair', 'Fleet Operations Lead', 2, [elena])],
  vessels: [
    vessel('vessel-1','MV Northern Star','Bulk Carrier','manager-1','assistant-1',1), vessel('vessel-2','MV Ocean Crest','Bulk Carrier','manager-1','',2), vessel('vessel-3','MV Baltic Dawn','Container','manager-1','assistant-2',3),
    vessel('vessel-4','MT Meridian','Product Tanker','manager-2','assistant-3',4), vessel('vessel-5','MT Blue Haven','Chemical Tanker','manager-2','',5), vessel('vessel-6','OSV Seafarer','Offshore Supply','manager-3','assistant-4',6), vessel('vessel-7','OSV Horizon','Platform Supply','manager-3','',7),
  ], footerText: 'Internal presentation • Crew Operations',
}
