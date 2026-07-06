import type { ChartData } from '../types'

export function createEmptyChartData(): ChartData {
  return {
    schemaVersion: 2,
    title: 'Crew Organization and Vessel Allocation Planner',
    organizationName: '',
    effectiveDate: '',
    crewDirectors: [],
    operationsManagers: [],
    vessels: [],
    footerText: '',
  }
}
