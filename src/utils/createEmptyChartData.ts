import type { ChartData } from '../types'

export function createEmptyChartData(): ChartData {
  return {
    schemaVersion: 2,
    title: 'Crew Operations Organization Chart',
    organizationName: '',
    effectiveDate: '',
    crewDirectors: [],
    operationsManagers: [],
    vessels: [],
    footerText: '',
  }
}
