import { apiClient } from './client'

export const reportsApi = {
  getSummary() {
    return apiClient.request('/api/reports/summary')
  },
  getVesselAllocationReport() {
    return apiClient.request('/api/reports/vessel-allocation')
  },
}
