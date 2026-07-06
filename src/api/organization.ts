import { apiClient } from './client'

export type OrganizationPayload = {
  name: string
  title: string
  effectiveDate?: string | null
  footerText?: string | null
}

export const organizationApi = {
  getOrganization(fresh = false) {
    return apiClient.request('/api/organization', { fresh })
  },
  updateOrganization(payload: OrganizationPayload) {
    return apiClient.request('/api/organization', { method: 'PATCH', body: JSON.stringify(payload) })
  },
}
