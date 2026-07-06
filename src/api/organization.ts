import { apiClient } from './client'

export type OrganizationPayload = {
  name: string
  title: string
  effectiveDate?: string | null
  footerText?: string | null
  crewDirectorName?: string
  crewDirectorDesignation?: string
  crewDirectorEmail?: string
  crewDirectorPhone?: string
  crewDirectorNotes?: string
}

export const organizationApi = {
  getOrganization() {
    return apiClient.request('/api/organization')
  },
  updateOrganization(payload: OrganizationPayload) {
    return apiClient.request('/api/organization', { method: 'PATCH', body: JSON.stringify(payload) })
  },
}
