export const EXPORT_WIDTH = 1920
export const EXPORT_HEIGHT = 1080
export const EXPORT_ASPECT_RATIO = 16 / 9

export type PresentationDensity = 'spacious' | 'balanced' | 'compact' | 'dense'

export interface PresentationMetrics {
  operationsManagers: number
  deputyManagers: number
  crewManagers: number
  vessels: number
}

export function getPresentationDensity(metrics: PresentationMetrics): PresentationDensity {
  const peopleWeight = metrics.operationsManagers * 4 + metrics.deputyManagers * 3 + metrics.crewManagers * 2
  const totalWeight = peopleWeight + metrics.vessels
  if (totalWeight <= 24) return 'spacious'
  if (totalWeight <= 64) return 'balanced'
  if (totalWeight <= 130) return 'compact'
  return 'dense'
}

export function choosePresentationColumns(itemCount: number, density: PresentationDensity, maximum = 5) {
  if (itemCount <= 1) return 1
  const preferred = density === 'spacious' ? 2 : density === 'balanced' ? 3 : density === 'compact' ? 4 : 5
  return Math.min(maximum, itemCount, preferred)
}

export function fitToSlide(contentWidth: number, contentHeight: number, availableWidth: number, availableHeight: number) {
  if (contentWidth <= 0 || contentHeight <= 0) return 1
  return Math.min(1, availableWidth / contentWidth, availableHeight / contentHeight)
}

export function splitEvenly<T>(items: readonly T[], columnCount: number): T[][] {
  const safeColumns = Math.max(1, Math.min(columnCount, Math.max(1, items.length)))
  const columns = Array.from({ length: safeColumns }, () => [] as T[])
  items.forEach((item, index) => columns[index % safeColumns].push(item))
  return columns
}
