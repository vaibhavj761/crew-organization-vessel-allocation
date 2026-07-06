import { apiClient } from './client'

export type OrganizationPayload = {
  name: string
  title: string
  effectiveDate?: string | null
  footerText?: string | null
}

export const organizationApi = {
  getOrganization() {
    return apiClient.request('/api/organization')
  },
  updateOrganization(payload: OrganizationPayload) {
    return apiClient.request('/api/organization', { method: 'PATCH', body: JSON.stringify(payload) })
  },
}
