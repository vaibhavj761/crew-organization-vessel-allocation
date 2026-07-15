import { APP_NAME } from '../constants/app'
import type { ChartData, CrewDirectorNode, CrewManagerNode, DeputyManagerNode, OperationsManagerNode, ViewMode } from '../types'

export type ExportTarget =
  | { kind: 'full' }
  | { kind: 'director'; directorId: string }
  | { kind: 'operations'; operationsManagerId: string }
  | { kind: 'manager'; crewManagerId: string }

const WIDTH = 1600
const HEIGHT = 900
const PAGE_MARGIN = 64

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  }[character] || character))
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}...` : value
}

function svgText(x: number, y: number, value: string, fontSize = 12, weight: number | string = 500, color = '#172b3f', anchor: 'start' | 'middle' | 'end' = 'start') {
  return `<text x="${x}" y="${y}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="${fontSize}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${escapeXml(value)}</text>`
}

function formatDate(value: string) {
  if (!value) return 'Not specified'
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function allDeputies(data: ChartData) {
  return data.operationsManagers.flatMap((op) => op.deputyManagers)
}

function allCrewManagers(data: ChartData) {
  return allDeputies(data).flatMap((deputy) => deputy.crewManagers)
}

function resolveDirector(data: ChartData, target: ExportTarget) {
  if (target.kind === 'director') return data.crewDirectors.find((item) => item.id === target.directorId) || null
  if (target.kind === 'operations') {
    const operationsManager = data.operationsManagers.find((item) => item.id === target.operationsManagerId)
    return data.crewDirectors.find((item) => item.id === operationsManager?.crewDirectorId) || null
  }
  if (target.kind === 'manager') {
    const operationsManager = data.operationsManagers.find((item) => item.deputyManagers.some((deputy) => deputy.crewManagers.some((crewManager) => crewManager.id === target.crewManagerId)))
    return data.crewDirectors.find((item) => item.id === operationsManager?.crewDirectorId) || null
  }
  return data.crewDirectors[0] || null
}

function resolveOperationsManager(data: ChartData, target: ExportTarget) {
  if (target.kind === 'operations') return data.operationsManagers.find((item) => item.id === target.operationsManagerId) || null
  if (target.kind === 'manager') {
    return data.operationsManagers.find((item) => item.deputyManagers.some((deputy) => deputy.crewManagers.some((crewManager) => crewManager.id === target.crewManagerId))) || null
  }
  return null
}

function resolveDeputyManager(data: ChartData, crewManagerId: string) {
  return allDeputies(data).find((deputy) => deputy.crewManagers.some((crewManager) => crewManager.id === crewManagerId)) || null
}

function vesselsForCrewManager(data: ChartData, crewManager: CrewManagerNode) {
  return data.vessels
    .filter((item) => item.crewManagerId === crewManager.id || item.crewManagerId === crewManager.person.id)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
}

function exportHeader(data: ChartData, title: string, subtitle: string) {
  return [
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="#f7f9fb"/>`,
    `<rect width="${WIDTH}" height="8" fill="#0b2447"/>`,
    `<rect x="${PAGE_MARGIN}" y="30" width="6" height="52" rx="3" fill="#4e83a6"/>`,
    svgText(PAGE_MARGIN + 20, 45, (data.organizationName || APP_NAME).toUpperCase(), 10, 700, '#4e83a6'),
    svgText(PAGE_MARGIN + 20, 76, title, 28, 700, '#102a43'),
    svgText(PAGE_MARGIN + 20, 96, subtitle, 11, 500, '#6a7e8f'),
    `<rect x="${WIDTH - 246}" y="34" width="182" height="44" rx="6" fill="#f1f5f7" stroke="#d7e0e7"/>`,
    svgText(WIDTH - 155, 51, 'EFFECTIVE DATE', 8, 700, '#688094', 'middle'),
    svgText(WIDTH - 155, 69, formatDate(data.effectiveDate), 12, 700, '#24465f', 'middle'),
    `<line x1="${PAGE_MARGIN}" y1="108" x2="${WIDTH - PAGE_MARGIN}" y2="108" stroke="#d7e0e7"/>`,
  ].join('')
}

function personBox(role: string, name: string, designation: string, x: number, y: number, width: number, variant: 'director' | 'operations' | 'deputy' | 'crew') {
  const fill = variant === 'director' ? '#0b2447' : variant === 'operations' ? '#17415f' : variant === 'deputy' ? '#2e7eb0' : '#ffffff'
  const stroke = variant === 'crew' ? '#bfd1dd' : fill
  const textColor = variant === 'crew' ? '#17344c' : '#ffffff'
  const subColor = variant === 'crew' ? '#5f7484' : '#dceaf2'
  return [
    `<rect x="${x}" y="${y}" width="${width}" height="72" rx="10" fill="${fill}" stroke="${stroke}"/>`,
    svgText(x + width / 2, y + 22, role.toUpperCase(), 8, 800, subColor, 'middle'),
    svgText(x + width / 2, y + 45, truncate(name || 'Not selected', 34), 16, 800, textColor, 'middle'),
    svgText(x + width / 2, y + 62, truncate(designation || role, 38), 9, 500, subColor, 'middle'),
  ].join('')
}

function connector(x1: number, y1: number, x2: number, y2: number) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#9aabb8" stroke-width="2" stroke-linecap="round"/>`
}

function crewCards(crewManagers: CrewManagerNode[], y: number, includeCounts: (crewManager: CrewManagerNode) => string = () => '') {
  if (!crewManagers.length) return svgText(WIDTH / 2, y + 40, 'No Crew Managers configured', 14, 600, '#6a7e8f', 'middle')
  const columns = Math.min(4, Math.max(1, crewManagers.length))
  const gap = 16
  const width = (WIDTH - PAGE_MARGIN * 2 - gap * (columns - 1)) / columns
  return crewManagers.map((crewManager, index) => {
    const row = Math.floor(index / columns)
    const col = index % columns
    const x = PAGE_MARGIN + col * (width + gap)
    const top = y + row * 92
    return personBox('Crew Manager', crewManager.person.name, includeCounts(crewManager) || crewManager.person.designation, x, top, width, 'crew')
  }).join('')
}

function allocationCrewCards(data: ChartData, crewManagers: CrewManagerNode[], y: number) {
  if (!crewManagers.length) return svgText(WIDTH / 2, y + 40, 'No Crew Managers configured', 14, 600, '#6a7e8f', 'middle')
  const columns = Math.min(3, Math.max(1, crewManagers.length))
  const gap = 18
  const cardWidth = (WIDTH - PAGE_MARGIN * 2 - gap * (columns - 1)) / columns
  const cardHeight = 168
  return crewManagers.map((crewManager, index) => {
    const row = Math.floor(index / columns)
    const col = index % columns
    const x = PAGE_MARGIN + col * (cardWidth + gap)
    const top = y + row * (cardHeight + 18)
    const vessels = vesselsForCrewManager(data, crewManager)
    const visible = vessels.slice(0, 6)
    const overflow = vessels.length - visible.length
    return [
      `<rect x="${x}" y="${top}" width="${cardWidth}" height="${cardHeight}" rx="12" fill="#ffffff" stroke="#cbd9e2"/>`,
      `<rect x="${x}" y="${top}" width="${cardWidth}" height="42" rx="12" fill="#f1f6f9"/>`,
      svgText(x + 18, top + 25, truncate(crewManager.person.name || 'Unnamed Crew Manager', 32), 15, 800, '#17344c'),
      svgText(x + cardWidth - 18, top + 25, `${vessels.length} vessels`, 11, 800, '#2e7eb0', 'end'),
      svgText(x + 18, top + 58, truncate(crewManager.person.designation || 'Crew Manager', 36), 10, 500, '#607789'),
      ...visible.map((vessel, vesselIndex) => {
        const vesselY = top + 82 + vesselIndex * 13
        return svgText(x + 22, vesselY, `• ${truncate(vessel.name, 44)}`, 10, 600, '#24465f')
      }),
      overflow > 0 ? svgText(x + 22, top + 82 + visible.length * 13, `+ ${overflow} more vessels`, 10, 700, '#6a7e8f') : '',
    ].join('')
  }).join('')
}

function footer(data: ChartData, label = '') {
  return [
    `<line x1="${PAGE_MARGIN}" y1="866" x2="${WIDTH - PAGE_MARGIN}" y2="866" stroke="#d7e0e7"/>`,
    svgText(PAGE_MARGIN, 886, data.footerText || 'Internal presentation', 8, 400, '#738697'),
    svgText(WIDTH - PAGE_MARGIN, 886, label || `${data.vessels.length} vessels`, 8, 700, '#738697', 'end'),
  ].join('')
}

function structureOverview(data: ChartData, directors: CrewDirectorNode[]) {
  let markup = exportHeader(data, data.title || APP_NAME, 'Reporting structure only - vessel names excluded')
  if (!directors.length) return markup + svgText(WIDTH / 2, 450, 'No Crew Directors configured', 18, 600, '#6a7e8f', 'middle') + footer(data)

  const director = directors[0]
  const operationsManagers = data.operationsManagers.filter((item) => item.crewDirectorId === director.id)
  markup += personBox('Crew Director', director.person.name, director.person.designation, 560, 130, 480, 'director')
  markup += connector(800, 202, 800, 228)

  if (!operationsManagers.length) return markup + svgText(WIDTH / 2, 280, 'No Crew Operations Managers configured', 14, 600, '#6a7e8f', 'middle') + footer(data)

  const opColumns = Math.min(3, operationsManagers.length)
  const opWidth = 420
  const opGap = 34
  const startX = (WIDTH - (opColumns * opWidth + (opColumns - 1) * opGap)) / 2
  operationsManagers.slice(0, 3).forEach((op, opIndex) => {
    const x = startX + opIndex * (opWidth + opGap)
    markup += personBox('Crew Operations Manager', op.person.name, op.person.designation, x, 230, opWidth, 'operations')
    op.deputyManagers.slice(0, 2).forEach((deputy, deputyIndex) => {
      const deputyY = 326 + deputyIndex * 178
      markup += connector(x + opWidth / 2, deputyY - 24, x + opWidth / 2, deputyY)
      markup += personBox('Deputy Manager', deputy.person.name, deputy.person.designation, x + 30, deputyY, opWidth - 60, 'deputy')
      markup += crewCards(deputy.crewManagers.slice(0, 4), deputyY + 92)
    })
  })

  return markup + footer(data, `${operationsManagers.length} operations managers · ${allDeputies(data).length} deputy managers · ${allCrewManagers(data).length} crew managers`)
}

function allocationOverview(data: ChartData, director: CrewDirectorNode | null, operationsManager: OperationsManagerNode | null, deputy: DeputyManagerNode | null, crewManager: CrewManagerNode | null) {
  const deputies = deputy ? [deputy] : operationsManager?.deputyManagers || []
  const managers = crewManager ? [crewManager] : deputies.flatMap((item) => item.crewManagers)
  return [
    exportHeader(data, `${operationsManager?.person.name || crewManager?.person.name || 'Operations'} - Vessel Allocation`, `Crew Director: ${director?.person.name || 'Not selected'}`),
    personBox('Crew Director', director?.person.name || 'Not selected', director?.person.designation || '', 560, 122, 480, 'director'),
    connector(800, 194, 800, 220),
    personBox('Crew Operations Manager', operationsManager?.person.name || 'Not selected', operationsManager?.person.designation || '', 524, 222, 552, 'operations'),
    deputies.slice(0, 3).map((item, index) => personBox('Deputy Manager', item.person.name, item.person.designation, PAGE_MARGIN + index * 500, 324, 468, 'deputy')).join(''),
    allocationCrewCards(data, managers, 430),
    footer(data, `${managers.length} crew managers · ${managers.reduce((sum, manager) => sum + vesselsForCrewManager(data, manager).length, 0)} vessels`),
  ].join('')
}

export function generateExportSvg(data: ChartData, target: ExportTarget) {
  const director = resolveDirector(data, target)
  const operationsManager = resolveOperationsManager(data, target)
  const crewManager = target.kind === 'manager' ? allCrewManagers(data).find((item) => item.id === target.crewManagerId) || null : null
  const deputy = crewManager ? resolveDeputyManager(data, crewManager.id) : null
  const directors = target.kind === 'director' && director ? [director] : data.crewDirectors

  const body = target.kind === 'full' || target.kind === 'director'
    ? structureOverview(data, directors)
    : allocationOverview(data, director, operationsManager, deputy, crewManager)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${body}</svg>`
}

export function generateChartSvg(data: ChartData, viewMode: ViewMode, operationsManagerId = '') {
  if (viewMode === 'overview') return generateExportSvg(data, { kind: 'full' })
  if (viewMode === 'operations' && operationsManagerId) return generateExportSvg(data, { kind: 'operations', operationsManagerId })
  return generateExportSvg(data, { kind: 'full' })
}
