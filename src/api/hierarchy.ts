import { apiClient } from './client'
import type { CrewDirectorNode, Person } from '../types'

export const hierarchyApi = {
  getHierarchy(fresh = false) {
    return apiClient.request('/api/hierarchy', { fresh })
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
  createDeputyManager(payload: Person & { operationsManagerId: string; sortOrder?: number }) {
    return apiClient.request('/api/deputy-managers', { method: 'POST', body: JSON.stringify(payload) })
  },
  updateDeputyManager(id: string, payload: Partial<Person> & { operationsManagerId?: string; sortOrder?: number }) {
    return apiClient.request(`/api/deputy-managers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
  },
  deleteDeputyManager(id: string) {
    return apiClient.request(`/api/deputy-managers/${id}`, { method: 'DELETE' })
  },
  createCrewManager(payload: Person & { deputyManagerId: string; sortOrder?: number }) {
    return apiClient.request('/api/crew-managers', { method: 'POST', body: JSON.stringify(payload) })
  },
  updateCrewManager(id: string, payload: Partial<Person> & { deputyManagerId?: string; sortOrder?: number }) {
    return apiClient.request(`/api/crew-managers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
  },
  deleteCrewManager(id: string) {
    return apiClient.request(`/api/crew-managers/${id}`, { method: 'DELETE' })
  },
}
