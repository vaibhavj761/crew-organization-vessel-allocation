import type { ChartData } from '../types'
import { EXPORT_HEIGHT, EXPORT_WIDTH } from './exportLayout'
import { generateExportSvg, type ExportTarget } from './exportSvg'

declare global {
  interface Window {
    __crewOrgLastExport?: {
      filename: string
      mimeType: string
      url: string
      createdAt: number
      status?: 'preparing' | 'ready' | 'error'
      error?: string
    }
  }
}

function markExport(result: Window['__crewOrgLastExport']) {
  window.__crewOrgLastExport = result
  document.documentElement.dataset.exportStatus = result?.status || ''
  document.documentElement.dataset.exportFilename = result?.filename || ''
  document.documentElement.dataset.exportError = result?.error || ''
  document.documentElement.dataset.exportUrl = result?.url || ''
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  markExport({ filename, mimeType: blob.type, url, createdAt: Date.now(), status: 'ready' })
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'team'
}

export function getExportFilename(data: ChartData, target: ExportTarget, extension: 'png' | 'svg') {
  if (target.kind === 'full') return `crew-org-full-chart.${extension}`
  if (target.kind === 'director' || target.kind === 'director-allocation') {
    const director = data.crewDirectors.find((item) => item.id === target.directorId)
    return `crew-director-${slug(director?.person.name || 'team')}-team.${extension}`
  }
  if (target.kind === 'operations') {
    const operationsManager = data.operationsManagers.find((item) => item.id === target.operationsManagerId)
    return `operations-manager-${slug(operationsManager?.person.name || 'team')}-team.${extension}`
  }
  const manager = data.operationsManagers
    .flatMap((item) => item.deputyManagers.flatMap((deputy) => deputy.crewManagers))
    .find((item) => item.id === target.crewManagerId)
  return `crew-manager-${slug(manager?.person.name || 'team')}-allocation.${extension}`
}

async function waitForRenderReadiness() {
  if (document.fonts?.ready) await document.fonts.ready
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

function loadExportImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('The browser could not render the presentation image.'))
    image.src = source
  })
}

async function renderSvgImage(svg: string) {
  const objectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    return await loadExportImage(objectUrl)
  } catch {
    // A restrictive proxy or browser policy may reject blob image sources even
    // though a data image is permitted. Keep a second, self-contained path so
    // production export does not depend on blob rendering alone.
    return loadExportImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export function exportSvg(data: ChartData, target: ExportTarget) {
  const filename = getExportFilename(data, target, 'svg')
  markExport({ filename, mimeType: 'image/svg+xml', url: '', createdAt: Date.now(), status: 'preparing' })
  const svg = generateExportSvg(data, target)
  download(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), filename)
}

export async function exportPng(data: ChartData, target: ExportTarget) {
  const filename = getExportFilename(data, target, 'png')
  markExport({ filename, mimeType: 'image/png', url: '', createdAt: Date.now(), status: 'preparing' })
  try {
    await waitForRenderReadiness()
    const svg = generateExportSvg(data, target)
    const image = await renderSvgImage(svg)
    if ('decode' in image) await image.decode().catch(() => undefined)

    const canvas = document.createElement('canvas')
    canvas.width = EXPORT_WIDTH * 2
    canvas.height = EXPORT_HEIGHT * 2
    const context = canvas.getContext('2d')
    if (!context) throw new Error('PNG export is not supported by this browser.')
    context.fillStyle = '#f6f8fa'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1))
    if (!blob) throw new Error('The presentation image could not be encoded.')
    download(blob, filename)
  } catch (error) {
    markExport({
      filename,
      mimeType: 'image/png',
      url: '',
      createdAt: Date.now(),
      status: 'error',
      error: error instanceof Error ? error.message : 'Export failed.',
    })
    throw error
  }
}
