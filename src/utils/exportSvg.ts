import { APP_NAME } from '../constants/app'
import type { ChartData, CrewDirectorNode, CrewManagerNode, OperationsManagerNode, Vessel, ViewMode } from '../types'
import { getCrewManagersForOperationsManager, getVesselColumnCount } from './operationsAllocation'

export type ExportTarget =
  | { kind: 'full' }
  | { kind: 'director'; directorId: string }
  | { kind: 'operations'; operationsManagerId: string }
  | { kind: 'manager'; crewManagerId: string }

const WIDTH = 1600
const HEIGHT = 900
const PAGE_MARGIN = 64
const BODY_TOP = 188

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
  return value.length > length ? `${value.slice(0, length - 1)}…` : value
}

function svgText(x: number, y: number, value: string, fontSize = 12, weight: number | string = 500, color = '#172b3f', anchor: 'start' | 'middle' | 'end' = 'start') {
  return `<text x="${x}" y="${y}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="${fontSize}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${escapeXml(value)}</text>`
}

function formatDate(value: string) {
  if (!value) return 'Not specified'
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function resolveDirector(data: ChartData, target: ExportTarget) {
  if (target.kind === 'director') return data.crewDirectors.find((item) => item.id === target.directorId) || null
  if (target.kind === 'operations') {
    const operationsManager = data.operationsManagers.find((item) => item.id === target.operationsManagerId)
    return data.crewDirectors.find((item) => item.id === operationsManager?.crewDirectorId) || null
  }
  if (target.kind === 'manager') {
    const operationsManager = data.operationsManagers.find((item) => item.crewManagers.some((crewManager) => crewManager.id === target.crewManagerId))
    return data.crewDirectors.find((item) => item.id === operationsManager?.crewDirectorId) || null
  }
  return data.crewDirectors[0] || null
}

function resolveOperationsManager(data: ChartData, target: ExportTarget) {
  if (target.kind === 'operations') return data.operationsManagers.find((item) => item.id === target.operationsManagerId) || null
  if (target.kind === 'manager') {
    return data.operationsManagers.find((item) => item.crewManagers.some((crewManager) => crewManager.id === target.crewManagerId)) || null
  }
  return null
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

function personBanner(role: string, name: string, x: number, y: number, width: number, variant: 'director' | 'operations') {
  if (variant === 'director') {
    return [
      `<rect x="${x}" y="${y}" width="${width}" height="66" rx="10" fill="#0b2447"/>`,
      svgText(x + width / 2, y + 22, role.toUpperCase(), 8, 700, '#8eb7d1', 'middle'),
      svgText(x + width / 2, y + 45, truncate(name || 'Not selected', 42), 19, 700, '#ffffff', 'middle'),
    ].join('')
  }

  return [
    `<rect x="${x}" y="${y}" width="${width}" height="56" rx="9" fill="#eaf1f5" stroke="#d7e0e7"/>`,
    svgText(x + width / 2, y + 21, role.toUpperCase(), 8, 700, '#4e83a6', 'middle'),
    svgText(x + width / 2, y + 41, truncate(name || 'Not selected', 42), 16, 700, '#17344c', 'middle'),
  ].join('')
}

function vesselTag(vessel: Vessel, x: number, y: number, width: number) {
  return [
    `<rect x="${x}" y="${y}" width="${width}" height="28" rx="5" fill="#f8fafb" stroke="#e1e7ec"/>`,
    svgText(x + 12, y + 18, truncate(vessel.name, 28), 9, 700, '#17344c'),
  ].join('')
}

function teamCard(data: ChartData, crewManager: CrewManagerNode, x: number, y: number, width: number, height: number, vesselNamesOnly = true) {
  const vessels = vesselsForCrewManager(data, crewManager)
  const assistants = crewManager.assistants
  const columnCount = vesselNamesOnly ? getVesselColumnCount(vessels.length) : 1
  const vesselAreaWidth = width - 36
  const vesselGap = 10
  const columnWidth = columnCount === 1
    ? vesselAreaWidth
    : (vesselAreaWidth - vesselGap * (columnCount - 1)) / columnCount
  const visibleRows = Math.max(1, Math.floor((height - 178) / 32))
  const visibleCount = Math.min(vessels.length, visibleRows * columnCount)

  let markup = [
    `<g>`,
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10" fill="#ffffff" stroke="#ccd7df"/>`,
    `<rect x="${x}" y="${y}" width="${width}" height="5" rx="3" fill="#24465f"/>`,
    `<rect x="${x}" y="${y + 5}" width="${width}" height="66" fill="#f3f6f8"/>`,
    svgText(x + width / 2, y + 24, 'CREW MANAGER', 8, 700, '#4e83a6', 'middle'),
    svgText(x + width / 2, y + 47, truncate(crewManager.person.name || 'Unnamed manager', 30), 17, 700, '#17344c', 'middle'),
    svgText(x + width / 2, y + 62, truncate(crewManager.person.designation || 'Designation not set', 38), 9, 500, '#6a7e8f', 'middle'),
    `<rect x="${x + width - 96}" y="${y + 20}" width="74" height="22" rx="11" fill="#e5edf2"/>`,
    svgText(x + width - 59, y + 35, `${vessels.length} vessels`, 8, 700, '#31526b', 'middle'),
    `<line x1="${x + 18}" y1="${y + 84}" x2="${x + width - 18}" y2="${y + 84}" stroke="#e1e7ec"/>`,
    svgText(x + 18, y + 102, `SUPPORT TEAM · ${assistants.length}`, 8, 700, '#516b80'),
  ].join('')

  if (assistants.length) {
    assistants.slice(0, 4).forEach((assistant, index) => {
      const chipY = y + 114 + index * 18
      markup += `<rect x="${x + 18}" y="${chipY}" width="${width - 36}" height="14" rx="7" fill="#f1f5f7" stroke="#e2e9ed"/>`
      markup += svgText(x + 26, chipY + 10, truncate(`${assistant.name} · ${assistant.designation || 'Assistant'}`, 52), 8, 600, '#24465f')
    })
    if (assistants.length > 4) {
      markup += svgText(x + width - 18, y + 185, `${assistants.length - 4} more assistants`, 7, 700, '#4e83a6', 'end')
    }
  } else {
    markup += svgText(x + width / 2, y + 128, 'No assistants assigned yet', 8, 500, '#7b8d9b', 'middle')
  }

  markup += `<line x1="${x + 18}" y1="${y + 192}" x2="${x + width - 18}" y2="${y + 192}" stroke="#e1e7ec"/>`
  markup += svgText(x + 18, y + 209, vesselNamesOnly ? 'ALLOCATED VESSEL NAMES' : 'VESSEL ALLOCATION', 8, 700, '#516b80')

  const visibleVessels = vessels.slice(0, visibleCount)
  visibleVessels.forEach((vessel, index) => {
    const columnIndex = Math.floor(index / visibleRows)
    const rowIndex = index % visibleRows
    const vesselX = x + 18 + columnIndex * (columnWidth + vesselGap)
    const vesselY = y + 220 + rowIndex * 32
    markup += vesselTag(vessel, vesselX, vesselY, columnWidth)
  })

  if (!visibleVessels.length) {
    markup += svgText(x + width / 2, y + 236, 'No vessels assigned yet', 8, 500, '#7b8d9b', 'middle')
  }

  if (vessels.length > visibleCount) {
    markup += svgText(x + width - 18, y + height - 12, `${vessels.length - visibleCount} more vessels in detailed view`, 7, 700, '#4e83a6', 'end')
  }

  markup += '</g>'
  return markup
}

function footer(data: ChartData, label = '') {
  return [
    `<line x1="${PAGE_MARGIN}" y1="866" x2="${WIDTH - PAGE_MARGIN}" y2="866" stroke="#d7e0e7"/>`,
    svgText(PAGE_MARGIN, 886, data.footerText || 'Internal presentation', 8, 400, '#738697'),
    svgText(WIDTH - PAGE_MARGIN, 886, label || `${data.vessels.length} vessels`, 8, 700, '#738697', 'end'),
  ].join('')
}

function hierarchyBeam(crewManagerCount: number, y: number) {
  if (crewManagerCount <= 1) return ''

  const beamHalfWidth = crewManagerCount === 2 ? 250 : crewManagerCount === 3 ? 380 : 500
  return `<line x1="${WIDTH / 2 - beamHalfWidth}" y1="${y}" x2="${WIDTH / 2 + beamHalfWidth}" y2="${y}" stroke="#6b879c" stroke-width="2.5" stroke-linecap="round" opacity="0.88"/>`
}

function teamGrid(data: ChartData, crewManagers: CrewManagerNode[], top: number, fullWidth = false) {
  if (!crewManagers.length) {
    return svgText(WIDTH / 2, 450, 'No Crew Managers configured', 16, 600, '#6a7e8f', 'middle')
  }

  const columns = crewManagers.length === 1
    ? 1
    : crewManagers.length === 2
      ? 2
      : fullWidth
        ? Math.min(4, crewManagers.length)
        : Math.min(3, crewManagers.length)
  const rows = Math.ceil(crewManagers.length / columns)
  const gap = 18
  const availableWidth = WIDTH - PAGE_MARGIN * 2
  const width = columns === 1
    ? Math.min(620, availableWidth * 0.48)
    : ((availableWidth) - gap * (columns - 1)) / columns
  const height = Math.max(180, (842 - top - gap * (rows - 1)) / rows)

  return crewManagers.map((crewManager, index) => {
    const rowIndex = Math.floor(index / columns)
    const itemsInRow = Math.min(columns, crewManagers.length - rowIndex * columns)
    const rowWidth = itemsInRow * width + (itemsInRow - 1) * gap
    const rowStart = (WIDTH - rowWidth) / 2
    const x = rowStart + (index % columns) * (width + gap)
    const y = top + Math.floor(index / columns) * (height + gap)
    return teamCard(data, crewManager, x, y, width, height, true)
  }).join('')
}

function fullOverview(data: ChartData) {
  let markup = exportHeader(data, data.title || APP_NAME, 'Organization overview')
  const directors = data.crewDirectors

  if (!directors.length) {
    markup += svgText(WIDTH / 2, 450, 'No Crew Directors configured', 18, 600, '#6a7e8f', 'middle')
    return markup + footer(data)
  }

  const gap = 18
  const groupWidth = ((WIDTH - PAGE_MARGIN * 2) - gap * (directors.length - 1)) / directors.length

  directors.forEach((director, directorIndex) => {
    const x = PAGE_MARGIN + directorIndex * (groupWidth + gap)
    const operationsManagers = data.operationsManagers.filter((item) => item.crewDirectorId === director.id)
    markup += personBanner('Crew Director', director.person.name, x, 122, groupWidth, 'director')

    if (!operationsManagers.length) {
      markup += `<rect x="${x}" y="196" width="${groupWidth}" height="68" rx="8" fill="#ffffff" stroke="#d7e0e7"/>`
      markup += svgText(x + 18, 234, 'No Crew Operations Managers assigned yet', 11, 500, '#6a7e8f')
      return
    }

    const opGap = 12
    const operationsWidth = (groupWidth - opGap * (operationsManagers.length - 1)) / operationsManagers.length
    operationsManagers.forEach((operationsManager, operationsIndex) => {
      const opX = x + operationsIndex * (operationsWidth + opGap)
      markup += personBanner('Crew Operations Manager', operationsManager.person.name, opX, 196, operationsWidth, 'operations')

      const featuredManager = operationsManager.crewManagers[0]
      if (!featuredManager) {
        markup += `<rect x="${opX}" y="256" width="${operationsWidth}" height="84" rx="8" fill="#fff" stroke="#d7e0e7"/>`
        markup += svgText(opX + 18, 302, 'No Crew Managers assigned yet', 11, 500, '#6a7e8f')
        return
      }

      markup += teamCard(data, featuredManager, opX, 252, operationsWidth, 604, true)
      if (operationsManager.crewManagers.length > 1) {
        markup += svgText(opX + operationsWidth - 18, 852, `${operationsManager.crewManagers.length - 1} more team card(s) in filtered view`, 7, 700, '#4e83a6', 'end')
      }
    })
  })

  return markup + footer(data, `${data.crewDirectors.length} Crew Directors · ${data.operationsManagers.length} Crew Operations Managers`)
}

function directorOverview(data: ChartData, director: CrewDirectorNode | null) {
  const operationsManagers = data.operationsManagers.filter((item) => item.crewDirectorId === director?.id)
  const crewManagers = operationsManagers.flatMap((item) => item.crewManagers)
  return [
    exportHeader(
      data,
      `${director?.person.name || 'Crew Director'} · Team Overview`,
      'Filtered Crew Director team export',
    ),
    personBanner('Crew Director', director?.person.name || 'Not selected', PAGE_MARGIN, 122, WIDTH - PAGE_MARGIN * 2, 'director'),
    teamGrid(data, crewManagers, BODY_TOP, true),
    footer(data, `${operationsManagers.length} Crew Operations Managers · ${crewManagers.length} Crew Managers`),
  ].join('')
}

function operationsOverview(data: ChartData, director: CrewDirectorNode | null, operationsManager: OperationsManagerNode | null) {
  const crewManagers = getCrewManagersForOperationsManager(operationsManager || undefined)
  return [
    exportHeader(
      data,
      `${operationsManager?.person.name || 'Crew Operations Manager'} · Team Allocation`,
      `Crew Director: ${director?.person.name || 'Not selected'}`,
    ),
    personBanner('Crew Director', director?.person.name || 'Not selected', 472, 122, 656, 'director'),
    `<line x1="800" y1="188" x2="800" y2="206" stroke="#6b879c" stroke-width="2.5" stroke-linecap="round"/>`,
    personBanner('Crew Operations Manager', operationsManager?.person.name || 'Not selected', 524, 208, 552, 'operations'),
    `<line x1="800" y1="264" x2="800" y2="286" stroke="#6b879c" stroke-width="2.5" stroke-linecap="round"/>`,
    hierarchyBeam(crewManagers.length, 286),
    teamGrid(data, crewManagers, 302),
    footer(data, `${crewManagers.length} Crew Managers`),
  ].join('')
}

function managerOverview(data: ChartData, director: CrewDirectorNode | null, operationsManager: OperationsManagerNode | null, crewManager: CrewManagerNode | null) {
  const visibleManagers = crewManager ? [crewManager] : []
  const vesselCount = crewManager ? vesselsForCrewManager(data, crewManager).length : 0
  return [
    exportHeader(
      data,
      `${crewManager?.person.name || 'Crew Manager'} · Allocation Focus`,
      `Crew Operations Manager: ${operationsManager?.person.name || 'Not selected'}`,
    ),
    personBanner('Crew Director', director?.person.name || 'Not selected', 472, 122, 656, 'director'),
    `<line x1="800" y1="188" x2="800" y2="206" stroke="#6b879c" stroke-width="2.5" stroke-linecap="round"/>`,
    personBanner('Crew Operations Manager', operationsManager?.person.name || 'Not selected', 524, 208, 552, 'operations'),
    `<line x1="800" y1="264" x2="800" y2="286" stroke="#6b879c" stroke-width="2.5" stroke-linecap="round"/>`,
    teamGrid(data, visibleManagers, 302),
    footer(data, `${vesselCount} vessel names shown`),
  ].join('')
}

export function generateExportSvg(data: ChartData, target: ExportTarget) {
  const director = resolveDirector(data, target)
  const operationsManager = resolveOperationsManager(data, target)
  const crewManager = target.kind === 'manager'
    ? operationsManager?.crewManagers.find((item) => item.id === target.crewManagerId) || null
    : null

  const body = target.kind === 'full'
    ? fullOverview(data)
    : target.kind === 'director'
      ? directorOverview(data, director)
      : target.kind === 'operations'
        ? operationsOverview(data, director, operationsManager)
        : managerOverview(data, director, operationsManager, crewManager)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${body}</svg>`
}

export function generateChartSvg(data: ChartData, viewMode: ViewMode, operationsManagerId = '') {
  if (viewMode === 'overview') return generateExportSvg(data, { kind: 'full' })
  if (viewMode === 'operations' && operationsManagerId) return generateExportSvg(data, { kind: 'operations', operationsManagerId })
  return generateExportSvg(data, { kind: 'full' })
}
