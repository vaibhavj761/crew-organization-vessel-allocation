import type { ChartData, CrewDirectorNode, CrewManagerNode, DeputyManagerNode, OperationsManagerNode, Person, Vessel } from '../types'

const person = <R extends Person['workflowRole']>(id: string, name: string, designation: string, workflowRole: R) => ({ id, name, designation, workflowRole, email: '', phone: '', notes: '' } as Person & { workflowRole: R })
const manager = (id: string, name: string, designation: string, sortOrder: number): CrewManagerNode => ({ id: `team-${id}`, reportingLineId: `crew-line-${id}`, isPrimaryReportingLine: true, sortOrder, person: person(id, name, designation, 'CREW_MANAGER'), vesselIds: [] })
const deputy = (id: string, operationsManagerId: string, name: string, designation: string, sortOrder: number, crewManagers: CrewManagerNode[]): DeputyManagerNode => ({ id: `deputy-node-${id}`, reportingLineId: `deputy-line-${id}`, isPrimaryReportingLine: true, operationsManagerId, sortOrder, person: person(id, name, designation, 'DEPUTY_MANAGER'), crewManagers })
const director = (id: string, name: string, designation: string, sortOrder: number): CrewDirectorNode => ({ id: `director-node-${id}`, sortOrder, person: person(id, name, designation, 'CREW_DIRECTOR') })
const ops = (id: string, crewDirectorId: string, name: string, designation: string, sortOrder: number, deputyManagers: DeputyManagerNode[]): OperationsManagerNode => ({ id: `ops-node-${id}`, reportingLineId: `operations-line-${id}`, isPrimaryReportingLine: true, crewDirectorId, sortOrder, person: person(id, name, designation, 'OPERATIONS_MANAGER'), deputyManagers })
const vessel = (id: string, name: string, type: string, crewManagerId: string, sortOrder: number): Vessel => {
  const managerNumber = crewManagerId.endsWith('3') ? '3' : crewManagerId.endsWith('2') ? '2' : '1'
  const secondBranch = managerNumber === '3'
  return {
    id, name, vesselType: type, vesselDoc: 'Northstar DOC', deadweightTonnage: '', ownerPool: 'Managed Pool', ownerName: '', vesselManager: 'Northstar Ship Management',
    crewManagerId,
    crewManagerReportingLineId: `crew-line-manager-${managerNumber}`,
    deputyManagerId: `deputy-node-deputy-${secondBranch ? '2' : '1'}`,
    operationsManagerId: `ops-node-ops-${secondBranch ? '2' : '1'}`,
    assignedAssistantId: '', vesselStatus: 'IN_MANAGEMENT', managementType: 'FULL_MANAGED', notes: '', sortOrder,
  }
}

const leena = manager('manager-1', 'Leena Thomas', 'Crew Manager', 1)
const vikram = manager('manager-2', 'Vikram Menon', 'Crew Manager', 2)
const elena = manager('manager-3', 'Elena George', 'Crew Manager', 1)
leena.vesselIds = ['vessel-1', 'vessel-2', 'vessel-3']; vikram.vesselIds = ['vessel-4', 'vessel-5']; elena.vesselIds = ['vessel-6', 'vessel-7']

const directorOne = director('director-1', 'Anita Rao', 'Managing Director', 1)
const directorTwo = director('director-2', 'Rahul Sen', 'Executive Director', 2)
const opsOneId = 'ops-node-ops-1'
const opsTwoId = 'ops-node-ops-2'
const deputyOne = deputy('deputy-1', opsOneId, 'Pavan Kesari', 'Deputy Crew Manager', 1, [leena, vikram])
const deputyTwo = deputy('deputy-2', opsTwoId, 'Namrata Joshi', 'Deputy Manager', 1, [elena])

export const sampleData: ChartData = {
  schemaVersion: 2, title: 'Crew Operations Organization Chart', organizationName: 'Northstar Maritime Services', effectiveDate: '2026-07-01',
  crewDirectors: [{ ...directorOne, person: { ...directorOne.person, email: 'anita.rao@example.com' } }, directorTwo],
  operationsManagers: [
    ops('ops-1', directorOne.id, 'Marcus Pereira', 'Crew Operations Manager', 1, [deputyOne]),
    ops('ops-2', directorTwo.id, 'Priya Nair', 'Fleet Operations Lead', 2, [deputyTwo]),
  ],
  vessels: [
    vessel('vessel-1','MV Northern Star','Bulk Carrier','team-manager-1',1), vessel('vessel-2','MV Ocean Crest','Bulk Carrier','team-manager-1',2), vessel('vessel-3','MV Baltic Dawn','Container','team-manager-1',3),
    vessel('vessel-4','MT Meridian','Product Tanker','team-manager-2',4), vessel('vessel-5','MT Blue Haven','Chemical Tanker','team-manager-2',5), vessel('vessel-6','OSV Seafarer','Offshore Supply','team-manager-3',6), vessel('vessel-7','OSV Horizon','Platform Supply','team-manager-3',7),
  ], footerText: 'Internal presentation • Crew Operations Organization Chart',
}
