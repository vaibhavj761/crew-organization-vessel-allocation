import type { ChartData } from '../types'

export const STORAGE_KEY = 'crew-chart-builder:v2'
const LEGACY_KEY = 'crew-chart-builder:v1'

export function loadChartData(): unknown | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_KEY)
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

export function saveChartData(data: ChartData): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}
