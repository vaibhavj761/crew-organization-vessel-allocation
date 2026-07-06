import { apiClient } from './client'
import type { Assistant, CrewDirectorNode, Person } from '../types'

export const hierarchyApi = {
  getHierarchy() {
    return apiClient.request('/api/hierarchy')
  },
  createCrewDirector(payload: CrewDirectorNode['person'] & { organizationId: string; sortOrder?: number }) {
    return apiClient.request('/api/crew-directors', { method: 'POST', body: JSON.stringify(payload) })
  },
  updateCrewDirector(id: string, payload: Partial<CrewDirectorNode['person']> & { sortOrder?: number }) {
    return apiClient.request(`/api/crew-directors/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
  },
  deleteCrewDirector(id: string) {
    return apiClient.request(`/api/crew-directors/${id}`, { method: 'DELETE' })
  },
  createOperationsManager(payload: Person & { crewDirectorId: string; sortOrder?: number }) {
    return apiClient.request('/api/operations-managers', { method: 'POST', body: JSON.stringify(payload) })
  },
  updateOperationsManager(id: string, payload: Partial<Person> & { crewDirectorId?: string; sortOrder?: number }) {
    return apiClient.request(`/api/operations-managers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
  },
  deleteOperationsManager(id: string) {
    return apiClient.request(`/api/operations-managers/${id}`, { method: 'DELETE' })
  },
  createCrewManager(payload: Person & { operationsManagerId: string; sortOrder?: number }) {
    return apiClient.request('/api/crew-managers', { method: 'POST', body: JSON.stringify(payload) })
  },
  updateCrewManager(id: string, payload: Partial<Person> & { operationsManagerId?: string; sortOrder?: number }) {
    return apiClient.request(`/api/crew-managers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
  },
  deleteCrewManager(id: string) {
    return apiClient.request(`/api/crew-managers/${id}`, { method: 'DELETE' })
  },
  createAssistant(payload: Assistant & { crewManagerId: string }) {
    return apiClient.request('/api/assistants', { method: 'POST', body: JSON.stringify(payload) })
  },
  updateAssistant(id: string, payload: Partial<Person> & { crewManagerId?: string; sortOrder?: number }) {
    return apiClient.request(`/api/assistants/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
  },
  deleteAssistant(id: string) {
    return apiClient.request(`/api/assistants/${id}`, { method: 'DELETE' })
  },
}
