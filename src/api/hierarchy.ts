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
  createOperationsManager(payload: Person & { crewDirectorId: string; managementHierarchyPositionId?: string; sortOrder?: number }) {
    return apiClient.request('/api/operations-managers', { method: 'POST', body: JSON.stringify(payload) })
  },
  updateOperationsManager(id: string, payload: Partial<Person> & { crewDirectorId?: string; sortOrder?: number }) {
    return apiClient.request(`/api/operations-managers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
  },
  deleteOperationsManager(id: string) {
    return apiClient.request(`/api/operations-managers/${id}`, { method: 'DELETE' })
  },
  createDeputyManager(payload: Person & { operationsManagerId: string; operationsManagerReportingLineId?: string; sortOrder?: number }) {
    return apiClient.request('/api/deputy-managers', { method: 'POST', body: JSON.stringify(payload) })
  },
  updateDeputyManager(id: string, payload: Partial<Person> & { operationsManagerId?: string; sortOrder?: number }) {
    return apiClient.request(`/api/deputy-managers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
  },
  deleteDeputyManager(id: string) {
    return apiClient.request(`/api/deputy-managers/${id}`, { method: 'DELETE' })
  },
  createCrewManager(payload: Person & { deputyManagerId: string; deputyManagerReportingLineId?: string; sortOrder?: number }) {
    return apiClient.request('/api/crew-managers', { method: 'POST', body: JSON.stringify(payload) })
  },
  updateCrewManager(id: string, payload: Partial<Person> & { deputyManagerId?: string; sortOrder?: number }) {
    return apiClient.request(`/api/crew-managers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
  },
  deleteCrewManager(id: string) {
    return apiClient.request(`/api/crew-managers/${id}`, { method: 'DELETE' })
  },
  updatePlacement(payload: {
    entityType: 'OPERATIONS_MANAGER' | 'DEPUTY_MANAGER' | 'CREW_MANAGER'
    entityId: string
    parentId: string
    parentPlacementId?: string
    action: 'MOVE' | 'COPY'
  }) {
    return apiClient.request('/api/hierarchy/placements', { method: 'POST', body: JSON.stringify(payload) })
  },
  removeCrewManagerPlacement(reportingLineId: string) {
    return apiClient.request(`/api/hierarchy/crew-manager-placements/${reportingLineId}`, { method: 'DELETE' })
  },
  removeDeputyManagerPlacement(reportingLineId: string) {
    return apiClient.request(`/api/hierarchy/deputy-manager-placements/${reportingLineId}`, { method: 'DELETE' })
  },
  removeOperationsManagerPlacement(reportingLineId: string) {
    return apiClient.request(`/api/hierarchy/operations-manager-placements/${reportingLineId}`, { method: 'DELETE' })
  },
  createManagementPosition(payload: {
    crewDirectorId: string
    parentPositionId?: string | null
    levelName: string
    name: string
    designation: string
    email?: string
    phone?: string
    notes?: string
    adoptDirectReports?: boolean
  }) {
    return apiClient.request('/api/hierarchy/management-positions', { method: 'POST', body: JSON.stringify(payload) })
  },
  updateManagementPosition(id: string, payload: Partial<{ levelName: string; name: string; designation: string; email: string; phone: string; notes: string; sortOrder: number }>) {
    return apiClient.request(`/api/hierarchy/management-positions/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
  },
  moveManagementPosition(id: string, parentPositionId: string | null) {
    return apiClient.request(`/api/hierarchy/management-positions/${id}/move`, { method: 'POST', body: JSON.stringify({ parentPositionId }) })
  },
  removeManagementPosition(id: string) {
    return apiClient.request(`/api/hierarchy/management-positions/${id}`, { method: 'DELETE' })
  },
  setOperationsManagementParent(reportingLineId: string, managementHierarchyPositionId: string | null) {
    return apiClient.request(`/api/hierarchy/operations-manager-placements/${reportingLineId}/management-parent`, {
      method: 'PATCH', body: JSON.stringify({ managementHierarchyPositionId }),
    })
  },
}
