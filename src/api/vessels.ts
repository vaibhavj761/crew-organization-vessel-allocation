import { apiClient } from './client'
import type { Vessel } from '../types'

export const vesselsApi = {
  getVessels(fresh = false) {
    return apiClient.request('/api/vessels', { fresh })
  },
  createVessel(payload: Partial<Vessel>) {
    return apiClient.request('/api/vessels', { method: 'POST', body: JSON.stringify(payload) })
  },
  updateVessel(id: string, payload: Partial<Vessel>) {
    return apiClient.request(`/api/vessels/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
  },
  deleteVessel(id: string) {
    return apiClient.request(`/api/vessels/${id}`, { method: 'DELETE' })
  },
  updateVesselAllocation(id: string, payload: { crewManagerId?: string | null; assignedAssistantId?: string | null }) {
    return apiClient.request(`/api/vessels/${id}/allocation`, { method: 'PATCH', body: JSON.stringify(payload) })
  },
}
