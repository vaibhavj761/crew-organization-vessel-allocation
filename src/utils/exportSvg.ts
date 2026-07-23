import { APP_NAME } from '../constants/app'
import type { ChartData, CrewDirectorNode, CrewManagerNode, DeputyManagerNode, OperationsManagerNode, ViewMode } from '../types'
import { choosePresentationColumns, EXPORT_HEIGHT, EXPORT_WIDTH, fitToSlide, getPresentationDensity, type PresentationDensity } from './exportLayout'
import { vesselBelongsToCrewManagerPlacement } from './operationsAllocation'

export type ExportTarget =
  | { kind: 'full' }
  | { kind: 'director'; directorId: string }
  | { kind: 'director-allocation'; directorId: string }
  | { kind: 'operations'; operationsManagerId: string }
  | { kind: 'manager'; crewManagerId: string }

const MARGIN_X = 58
const HEADER_BOTTOM = 126
const FOOTER_TOP = 1038
const CONTENT_TOP = 144
const CONTENT_HEIGHT = FOOTER_TOP - CONTENT_TOP - 14
const CONTENT_WIDTH = EXPORT_WIDTH - MARGIN_X * 2

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[character] || character))
}

function words(value: string, maxCharacters: number, maxLines = 2) {
  const clean = value.trim() || 'Not specified'
  const output: string[] = []
  let current = ''
  let truncated = false
  for (const word of clean.split(/\s+/)) {
    if (!current || `${current} ${word}`.length <= maxCharacters) {
      current = current ? `${current} ${word}` : word
      continue
    }
    output.push(current)
    if (output.length === maxLines) {
      truncated = true
      current = ''
      break
    }
    current = word
  }
  if (current && output.length < maxLines) output.push(current)
  const consumed = output.join(' ').length
  if ((truncated || consumed < clean.length) && output.length) output[output.length - 1] = `${output[output.length - 1].replace(/(?:\.{3}|…)$/, '')}…`
  return output.slice(0, maxLines)
}

function text(x: number, y: number, value: string, size = 12, weight: number | string = 500, color = '#172b3f', anchor: 'start' | 'middle' | 'end' = 'start', extra = '') {
  return `<text x="${x}" y="${y}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}" ${extra}>${escapeXml(value)}</text>`
}

function wrappedText(x: number, y: number, value: string, maxCharacters: number, lineHeight: number, size: number, weight: number | string, color: string, anchor: 'start' | 'middle' | 'end' = 'start', maxLines = 2) {
  return `<text x="${x}" y="${y}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${words(value, maxCharacters, maxLines).map((line, index) => `<tspan x="${x}" dy="${index ? lineHeight : 0}">${escapeXml(line)}</tspan>`).join('')}</text>`
}

function formatDate(value: string) {
  if (!value) return 'Current structure'
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function allDeputies(data: ChartData) {
  return data.operationsManagers.flatMap((operationsManager) => operationsManager.deputyManagers)
}

function rowsOf<T>(items: readonly T[], columns: number) {
  const rows: T[][] = []
  for (let index = 0; index < items.length; index += columns) rows.push(items.slice(index, index + columns))
  return rows
}

function allCrewManagers(data: ChartData) {
  return allDeputies(data).flatMap((deputyManager) => deputyManager.crewManagers)
}

function vesselsForCrewManager(data: ChartData, crewManager: CrewManagerNode) {
  return data.vessels
    .filter((vessel) => vesselBelongsToCrewManagerPlacement(vessel, crewManager))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
}

function resolveDirector(data: ChartData, target: ExportTarget) {
  if (target.kind === 'director' || target.kind === 'director-allocation') return data.crewDirectors.find((item) => item.id === target.directorId) || null
  if (target.kind === 'operations') {
    const operationsManager = data.operationsManagers.find((item) => item.id === target.operationsManagerId)
    return data.crewDirectors.find((item) => item.id === operationsManager?.crewDirectorId) || null
  }
  if (target.kind === 'manager') {
    const operationsManager = data.operationsManagers.find((item) => item.deputyManagers.some((deputy) => deputy.crewManagers.some((manager) => manager.id === target.crewManagerId)))
    return data.crewDirectors.find((item) => item.id === operationsManager?.crewDirectorId) || null
  }
  return null
}

function resolveOperationsManager(data: ChartData, target: ExportTarget) {
  if (target.kind === 'operations') return data.operationsManagers.find((item) => item.id === target.operationsManagerId) || null
  if (target.kind === 'manager') return data.operationsManagers.find((item) => item.deputyManagers.some((deputy) => deputy.crewManagers.some((manager) => manager.id === target.crewManagerId))) || null
  return null
}

function resolveDeputyManager(data: ChartData, crewManagerId: string) {
  return allDeputies(data).find((deputy) => deputy.crewManagers.some((manager) => manager.id === crewManagerId)) || null
}

function header(data: ChartData, title: string, subtitle: string, summary: string) {
  return [
    `<rect width="${EXPORT_WIDTH}" height="${EXPORT_HEIGHT}" fill="#f6f8fa"/>`,
    `<rect width="${EXPORT_WIDTH}" height="9" fill="#0b2447"/>`,
    `<rect x="${MARGIN_X}" y="34" width="5" height="62" rx="2.5" fill="#4e83a6"/>`,
    text(MARGIN_X + 19, 46, (data.organizationName || APP_NAME).toUpperCase(), 11, 800, '#547b96', 'start', 'letter-spacing="1.3"'),
    text(MARGIN_X + 19, 77, title, 30, 800, '#0b2447'),
    text(MARGIN_X + 19, 99, subtitle, 12, 500, '#607789'),
    `<rect x="${EXPORT_WIDTH - 366}" y="33" width="308" height="64" rx="10" fill="#ffffff" stroke="#d5e0e7"/>`,
    text(EXPORT_WIDTH - 346, 54, 'PRESENTATION SNAPSHOT', 9, 800, '#718696', 'start', 'letter-spacing=".9"'),
    text(EXPORT_WIDTH - 346, 76, summary, 12, 750, '#24465f'),
    text(EXPORT_WIDTH - 78, 76, formatDate(data.effectiveDate), 11, 650, '#607789', 'end'),
    `<line x1="${MARGIN_X}" y1="${HEADER_BOTTOM}" x2="${EXPORT_WIDTH - MARGIN_X}" y2="${HEADER_BOTTOM}" stroke="#d5dfe6"/>`,
  ].join('')
}

function footer(data: ChartData, scope: string) {
  return [
    `<line x1="${MARGIN_X}" y1="${FOOTER_TOP}" x2="${EXPORT_WIDTH - MARGIN_X}" y2="${FOOTER_TOP}" stroke="#d5dfe6"/>`,
    text(MARGIN_X, 1060, data.footerText || 'Internal management presentation', 9, 500, '#748696'),
    text(EXPORT_WIDTH - MARGIN_X, 1060, scope, 9, 700, '#607789', 'end'),
  ].join('')
}

function badge(x: number, y: number, value: string, width: number) {
  return `<rect x="${x}" y="${y}" width="${width}" height="22" rx="11" fill="#e8f0f5"/>${text(x + width / 2, y + 15, value, 9, 800, '#365d78', 'middle')}`
}

function identityCard(x: number, y: number, width: number, name: string, designation: string, variant: 'director' | 'operations' | 'deputy', density: PresentationDensity, note = '') {
  const compact = density === 'compact' || density === 'dense'
  const height = compact ? 64 : 76
  const fill = variant === 'director' ? '#0b2447' : variant === 'operations' ? '#173f5a' : '#2d739d'
  const role = variant === 'director' ? 'CREW DIRECTOR' : variant === 'operations' ? 'CREW OPERATIONS MANAGER' : 'DEPUTY MANAGER'
  const nameSize = compact ? 13 : 15
  const maxChars = Math.max(18, Math.floor(width / (nameSize * .56)))
  return [
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10" fill="${fill}"/>`,
    `<rect x="${x}" y="${y}" width="5" height="${height}" rx="2.5" fill="${variant === 'director' ? '#79a9c4' : '#93bfd5'}"/>`,
    text(x + 18, y + 18, role, compact ? 7.5 : 8.5, 800, '#cfe0e9', 'start', 'letter-spacing=".65"'),
    wrappedText(x + 18, y + (compact ? 39 : 42), name || 'Not selected', maxChars, 14, nameSize, 800, '#ffffff', 'start', 1),
    text(x + 18, y + height - 10, designation || role.replaceAll('_', ' '), compact ? 8 : 9, 550, '#dce8ef'),
    note ? badge(x + width - 86, y + 12, note, 72) : '',
  ].join('')
}

function crewManagerRow(x: number, y: number, width: number, crewManager: CrewManagerNode, vesselCount: number, density: PresentationDensity) {
  const height = density === 'dense' ? 43 : density === 'compact' ? 47 : 52
  const avatar = height - 16
  const nameSize = density === 'dense' ? 9.5 : 11
  const compact = density === 'dense' || density === 'compact'
  return [
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="7" fill="#ffffff" stroke="#cbd9e2"/>`,
    `<rect x="${x + 8}" y="${y + 8}" width="${avatar}" height="${avatar}" rx="${avatar / 2}" fill="#e5eff5"/>`,
    text(x + 8 + avatar / 2, y + 8 + avatar / 2 + 3.5, crewManager.person.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase(), 7.5, 800, '#2e6688', 'middle'),
    wrappedText(x + avatar + 17, y + (compact ? 16 : 18), crewManager.person.name || 'Unnamed Crew Manager', Math.max(14, Math.floor((width - avatar - 84) / 6)), compact ? 10 : 11, nameSize, 800, '#17344c', 'start', 2),
    compact ? '' : text(x + avatar + 17, y + height - 8, crewManager.person.designation || 'Crew Manager', 8, 550, '#667c8c'),
    badge(x + width - 66, y + (height - 22) / 2, `${vesselCount}`, 52),
  ].join('')
}

interface OperationsBlock {
  operationsManager: OperationsManagerNode
  naturalHeight: number
}

function structureBlockHeight(operationsManager: OperationsManagerNode, density: PresentationDensity, width: number) {
  const compact = density === 'compact' || density === 'dense'
  const identityHeight = compact ? 64 : 76
  const deputyColumns = density === 'spacious' ? 1 : Math.min(2, Math.max(1, operationsManager.deputyManagers.length))
  const deputyWidth = (width - 18 - (deputyColumns - 1) * 10) / deputyColumns
  const crewColumns = density === 'dense' && deputyWidth > 330 ? 2 : 1
  const rowHeight = density === 'dense' ? 43 : density === 'compact' ? 47 : 52
  const deputyHeights = operationsManager.deputyManagers.map((deputy) => {
    const crewRows = Math.ceil(Math.max(1, deputy.crewManagers.length) / crewColumns)
    return (compact ? 58 : 68) + crewRows * (rowHeight + 6) + 10
  })
  const rowHeights: number[] = []
  for (let index = 0; index < deputyHeights.length; index += deputyColumns) rowHeights.push(Math.max(...deputyHeights.slice(index, index + deputyColumns)))
  return identityHeight + 16 + rowHeights.reduce((sum, height) => sum + height, 0) + Math.max(0, rowHeights.length - 1) * 10 + 14
}

function structureOperationsBlock(data: ChartData, block: OperationsBlock, x: number, y: number, width: number, density: PresentationDensity) {
  const { operationsManager } = block
  const compact = density === 'compact' || density === 'dense'
  const identityHeight = compact ? 64 : 76
  const deputyColumns = density === 'spacious' ? 1 : Math.min(2, Math.max(1, operationsManager.deputyManagers.length))
  const deputyGap = 10
  const innerX = x + 9
  const innerWidth = width - 18
  const deputyWidth = (innerWidth - (deputyColumns - 1) * deputyGap) / deputyColumns
  const crewColumns = density === 'dense' && deputyWidth > 330 ? 2 : 1
  const rowHeight = density === 'dense' ? 43 : density === 'compact' ? 47 : 52
  let result = `<rect x="${x}" y="${y}" width="${width}" height="${block.naturalHeight}" rx="12" fill="#eef3f6" stroke="#cedae2"/>`
  result += identityCard(innerX, y + 9, innerWidth, operationsManager.person.name, operationsManager.person.designation, 'operations', density, operationsManager.person.notes)
  let deputyY = y + 9 + identityHeight + 12
  for (let index = 0; index < operationsManager.deputyManagers.length; index += deputyColumns) {
    const row = operationsManager.deputyManagers.slice(index, index + deputyColumns)
    const rowHeights = row.map((deputy) => {
      const crewRows = Math.ceil(Math.max(1, deputy.crewManagers.length) / crewColumns)
      return (compact ? 58 : 68) + crewRows * (rowHeight + 6) + 10
    })
    const rowMax = Math.max(...rowHeights)
    row.forEach((deputy, rowIndex) => {
      const deputyX = innerX + rowIndex * (deputyWidth + deputyGap)
      result += `<rect x="${deputyX}" y="${deputyY}" width="${deputyWidth}" height="${rowMax}" rx="9" fill="#f9fbfc" stroke="#bfd1dd"/>`
      result += identityCard(deputyX + 6, deputyY + 6, deputyWidth - 12, deputy.person.name, deputy.person.designation, 'deputy', density, deputy.person.notes)
      const crewTop = deputyY + (compact ? 70 : 80)
      const crewGap = 6
      const crewWidth = (deputyWidth - 12 - (crewColumns - 1) * crewGap) / crewColumns
      if (!deputy.crewManagers.length) result += text(deputyX + deputyWidth / 2, crewTop + 19, 'No Crew Managers assigned', 9, 600, '#738697', 'middle')
      deputy.crewManagers.forEach((manager, managerIndex) => {
        const col = managerIndex % crewColumns
        const rowIndex = Math.floor(managerIndex / crewColumns)
        result += crewManagerRow(deputyX + 6 + col * (crewWidth + crewGap), crewTop + rowIndex * (rowHeight + crewGap), crewWidth, manager, vesselsForCrewManager(data, manager).length, density)
      })
    })
    deputyY += rowMax + deputyGap
  }
  return result
}

function renderStructure(data: ChartData, directors: CrewDirectorNode[]) {
  const visibleOperations = data.operationsManagers.filter((operationsManager) =>
    directors.some((director) => operationsManager.crewDirectorId === director.id),
  )
  const metrics = {
    operationsManagers: visibleOperations.length,
    deputyManagers: visibleOperations.reduce((sum, operationsManager) => sum + operationsManager.deputyManagers.length, 0),
    crewManagers: visibleOperations.reduce((sum, operationsManager) => sum + operationsManager.deputyManagers.reduce((inner, deputy) => inner + deputy.crewManagers.length, 0), 0),
    vessels: 0,
  }
  const density = getPresentationDensity(metrics)
  const columns = choosePresentationColumns(visibleOperations.length, density, 4)
  const gap = density === 'dense' ? 12 : 16
  const columnWidth = (CONTENT_WIDTH - (columns - 1) * gap) / columns
  const blocks: OperationsBlock[] = visibleOperations.map((operationsManager) => ({ operationsManager, naturalHeight: structureBlockHeight(operationsManager, density, columnWidth) }))
  const blockRows = rowsOf(blocks, columns)
  const directorBandHeight = directors.length <= 1 ? 84 : 118
  const naturalHeight = directorBandHeight + blockRows.reduce((sum, row) => sum + Math.max(...row.map((item) => item.naturalHeight)), 0) + Math.max(0, blockRows.length - 1) * gap
  const scale = fitToSlide(CONTENT_WIDTH, naturalHeight, CONTENT_WIDTH, CONTENT_HEIGHT)
  const scaledWidth = CONTENT_WIDTH * scale
  const originX = MARGIN_X + (CONTENT_WIDTH - scaledWidth) / 2
  let body = header(data, data.title || 'Crew Operations Organization Chart', 'Reporting structure · vessel names intentionally excluded', `${metrics.operationsManagers} operations · ${metrics.crewManagers} crew managers`)
  body += `<g data-export-root="complete-chart" data-density="${density}" transform="translate(${originX} ${CONTENT_TOP}) scale(${scale})">`
  if (!directors.length) {
    body += text(CONTENT_WIDTH / 2, 190, 'No Crew Directors configured', 18, 700, '#607789', 'middle')
  } else {
    const directorWidth = Math.min(430, (CONTENT_WIDTH - Math.max(0, directors.length - 1) * 12) / directors.length)
    const directorStart = (CONTENT_WIDTH - (directors.length * directorWidth + Math.max(0, directors.length - 1) * 12)) / 2
    directors.forEach((director, index) => {
      body += identityCard(directorStart + index * (directorWidth + 12), 0, directorWidth, director.person.name, director.person.designation, 'director', density)
    })
    let rowY = directorBandHeight
    blockRows.forEach((row) => {
      const rowWidth = row.length * columnWidth + Math.max(0, row.length - 1) * gap
      const rowX = (CONTENT_WIDTH - rowWidth) / 2
      row.forEach((block, column) => {
        body += structureOperationsBlock(data, block, rowX + column * (columnWidth + gap), rowY, columnWidth, density)
      })
      rowY += Math.max(...row.map((item) => item.naturalHeight)) + gap
    })
  }
  body += '</g>'
  body += footer(data, `${directors.length} director${directors.length === 1 ? '' : 's'} · ${metrics.deputyManagers} deputies · ${metrics.crewManagers} crew managers`)
  return body
}

interface AllocationTeam {
  manager: CrewManagerNode
  deputy: DeputyManagerNode | null
}

function allocationCardHeight(data: ChartData, team: AllocationTeam, width: number, density: PresentationDensity) {
  const vessels = vesselsForCrewManager(data, team.manager)
  const vesselColumns = density === 'dense' ? 3 : density === 'compact' ? 2 : width >= 450 && vessels.length > 7 ? 2 : 1
  const rows = Math.ceil(Math.max(1, vessels.length) / vesselColumns)
  const rowHeight = density === 'dense' ? 28 : density === 'compact' ? 30 : 34
  return (density === 'dense' ? 76 : 88) + rows * rowHeight + 13
}

function allocationCard(data: ChartData, team: AllocationTeam, x: number, y: number, width: number, height: number, density: PresentationDensity) {
  const vessels = vesselsForCrewManager(data, team.manager)
  const vesselColumns = density === 'dense' ? 3 : density === 'compact' ? 2 : width >= 450 && vessels.length > 7 ? 2 : 1
  const vesselGap = 7
  const innerWidth = width - 24
  const vesselWidth = (innerWidth - (vesselColumns - 1) * vesselGap) / vesselColumns
  const rowHeight = density === 'dense' ? 28 : density === 'compact' ? 30 : 34
  const fontSize = density === 'dense' ? 8 : density === 'compact' ? 9 : 10
  let output = [
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="11" fill="#ffffff" stroke="#c9d7e0"/>`,
    `<rect x="${x}" y="${y}" width="${width}" height="54" rx="11" fill="#173f5a"/>`,
    `<rect x="${x}" y="${y + 43}" width="${width}" height="11" fill="#173f5a"/>`,
    wrappedText(x + 16, y + 24, team.manager.person.name || 'Unnamed Crew Manager', Math.max(18, Math.floor((width - 132) / 8)), 13, density === 'dense' ? 11 : 13, 800, '#ffffff', 'start', 1),
    text(x + 16, y + 43, team.manager.person.designation || 'Crew Manager', 8, 550, '#d7e7ef'),
    badge(x + width - 94, y + 16, `${vessels.length} vessels`, 78),
    text(x + 12, y + 71, team.deputy ? `Reports to ${team.deputy.person.name}` : 'Vessel allocation', 8, 750, '#5c7485'),
  ].join('')
  if (!vessels.length) output += text(x + width / 2, y + 100, 'No vessels assigned yet', 10, 600, '#718696', 'middle')
  vessels.forEach((vessel, index) => {
    const column = index % vesselColumns
    const row = Math.floor(index / vesselColumns)
    const vesselX = x + 12 + column * (vesselWidth + vesselGap)
    const vesselY = y + (density === 'dense' ? 78 : 83) + row * rowHeight
    output += `<rect x="${vesselX}" y="${vesselY}" width="${vesselWidth}" height="${rowHeight - 4}" rx="4" fill="#f2f6f8" stroke="#e0e8ed"/>`
    output += wrappedText(vesselX + 7, vesselY + 11, vessel.name || 'Unnamed vessel', Math.max(9, Math.floor((vesselWidth - 12) / (fontSize * .55))), fontSize + 1, fontSize, 650, '#24465f', 'start', 2)
  })
  return output
}

function renderAllocation(data: ChartData, director: CrewDirectorNode | null, operationsManager: OperationsManagerNode | null, deputy: DeputyManagerNode | null, crewManager: CrewManagerNode | null, directorScope: CrewDirectorNode | null) {
  const operations = operationsManager ? [operationsManager] : directorScope ? data.operationsManagers.filter((item) => item.crewDirectorId === directorScope.id) : []
  const teams: AllocationTeam[] = crewManager
    ? [{ manager: crewManager, deputy }]
    : operations.flatMap((operation) => operation.deputyManagers.flatMap((item) => item.crewManagers.map((manager) => ({ manager, deputy: item }))))
  const vesselCount = teams.reduce((sum, team) => sum + vesselsForCrewManager(data, team.manager).length, 0)
  const metrics = { operationsManagers: operations.length, deputyManagers: new Set(teams.map((team) => team.deputy?.id).filter(Boolean)).size, crewManagers: teams.length, vessels: vesselCount }
  const density = getPresentationDensity(metrics)
  const columns = choosePresentationColumns(teams.length, density, 4)
  const gap = density === 'dense' ? 10 : 14
  const columnWidth = (CONTENT_WIDTH - (columns - 1) * gap) / columns
  const cards = teams.map((team) => ({ team, height: allocationCardHeight(data, team, columnWidth, density) }))
  const cardRows = rowsOf(cards, columns)
  const leadershipHeight = 90
  const naturalHeight = leadershipHeight + cardRows.reduce((sum, row) => sum + Math.max(...row.map((item) => item.height)), 0) + Math.max(0, cardRows.length - 1) * gap
  const scale = fitToSlide(CONTENT_WIDTH, naturalHeight, CONTENT_WIDTH, CONTENT_HEIGHT)
  const originX = MARGIN_X + (CONTENT_WIDTH - CONTENT_WIDTH * scale) / 2
  const titleName = crewManager?.person.name || operationsManager?.person.name || directorScope?.person.name || 'Operations'
  let output = header(data, `${titleName} · Vessel Allocation`, 'Complete team allocation · all assigned vessel names included', `${teams.length} crew managers · ${vesselCount} vessels`)
  output += `<g data-export-root="complete-chart" data-density="${density}" transform="translate(${originX} ${CONTENT_TOP}) scale(${scale})">`
  const leader = director || directorScope
  if (leader) output += identityCard(0, 0, 330, leader.person.name, leader.person.designation, 'director', density)
  if (operationsManager) output += identityCard(348, 0, 390, operationsManager.person.name, operationsManager.person.designation, 'operations', density)
  const leadershipX = operationsManager ? 758 : 348
  output += `<rect x="${leadershipX}" y="0" width="${CONTENT_WIDTH - leadershipX}" height="${density === 'compact' || density === 'dense' ? 64 : 76}" rx="10" fill="#e8f0f5" stroke="#cfdae2"/>`
  output += text(leadershipX + 18, 24, 'ALLOCATION SCOPE', 8, 800, '#56758a', 'start', 'letter-spacing=".7"')
  output += text(leadershipX + 18, 48, `${metrics.deputyManagers} deputies · ${teams.length} crew managers · ${vesselCount} vessels`, 14, 800, '#17344c')
  if (!teams.length) output += text(CONTENT_WIDTH / 2, 260, 'No Crew Managers found in this scope', 17, 700, '#607789', 'middle')
  let cardY = leadershipHeight
  cardRows.forEach((row) => {
    const rowWidth = row.length * columnWidth + Math.max(0, row.length - 1) * gap
    const rowX = (CONTENT_WIDTH - rowWidth) / 2
    row.forEach((item, column) => {
      output += allocationCard(data, item.team, rowX + column * (columnWidth + gap), cardY, columnWidth, item.height, density)
    })
    cardY += Math.max(...row.map((item) => item.height)) + gap
  })
  output += '</g>'
  output += footer(data, `${titleName} · ${vesselCount} vessel names`)
  return output
}

export function generateExportSvg(data: ChartData, target: ExportTarget) {
  const director = resolveDirector(data, target)
  const operationsManager = resolveOperationsManager(data, target)
  const crewManager = target.kind === 'manager' ? allCrewManagers(data).find((item) => item.id === target.crewManagerId) || null : null
  const deputy = crewManager ? resolveDeputyManager(data, crewManager.id) : null
  const directors = target.kind === 'director' && director ? [director] : data.crewDirectors
  const isAllocation = target.kind === 'operations' || target.kind === 'manager' || target.kind === 'director-allocation'
  const body = isAllocation
    ? renderAllocation(data, director, operationsManager, deputy, crewManager, target.kind === 'director-allocation' ? director : null)
    : renderStructure(data, directors)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${EXPORT_WIDTH}" height="${EXPORT_HEIGHT}" viewBox="0 0 ${EXPORT_WIDTH} ${EXPORT_HEIGHT}" role="img" aria-label="Crew Operations Organization Chart"><style>*{animation:none!important;transition:none!important}</style>${body}</svg>`
}

export function generateChartSvg(data: ChartData, viewMode: ViewMode, operationsManagerId = '') {
  if (viewMode === 'operations' && operationsManagerId) return generateExportSvg(data, { kind: 'operations', operationsManagerId })
  return generateExportSvg(data, { kind: 'full' })
}
