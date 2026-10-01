import type { ChartData, Vessel } from '../types'
import { getManagementChainForOperationsManager, getVesselPlacement } from './operationsAllocation'

const CSV_HEADERS = [
  'Vessel Name', 'Vessel Type', 'DOC', 'DWT', 'Owner Pool', 'Owner Name', 'Vessel Manager',
  'Status', 'Management Type', 'Crew Director', 'Head / Management Path',
  'Crew Operations Manager', 'Deputy Manager', 'Crew Manager / PIC', 'Notes',
]

function safeCsvCell(value: string) {
  const clean = String(value ?? '').trim()
  const protectedValue = /^[=+\-@\t\r]/.test(clean) ? `'${clean}` : clean
  return `"${protectedValue.replaceAll('"', '""')}"`
}

export function buildVesselMasterCsv(data: ChartData, vessels: Vessel[]) {
  const rows = vessels.map((vessel) => {
    const placement = getVesselPlacement(data, vessel)
    const operationsManager = placement?.operationsManager
      || data.operationsManagers.find((item) => item.id === vessel.operationsManagerId)
    const director = data.crewDirectors.find((item) => item.id === operationsManager?.crewDirectorId)
    const managementPath = getManagementChainForOperationsManager(data, operationsManager)
      .map((position) => `${position.person.name} (${position.levelName})`)
      .join(' > ')
    return [
      vessel.name, vessel.vesselType, vessel.vesselDoc, vessel.deadweightTonnage,
      vessel.ownerPool, vessel.ownerName, vessel.vesselManager, vessel.vesselStatus,
      vessel.managementType, director?.person.name || '', managementPath,
      operationsManager?.person.name || '', placement?.deputyManager.person.name || '',
      placement?.crewManager.person.name || '', vessel.notes,
    ]
  })
  return `\uFEFF${[CSV_HEADERS, ...rows].map((row) => row.map(safeCsvCell).join(',')).join('\r\n')}`
}

export function downloadVesselMasterCsv(data: ChartData, vessels: Vessel[]) {
  const blob = new Blob([buildVesselMasterCsv(data, vessels)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `vessel-master-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
