import { apiClient } from './client'

export const usersApi = {
  list() {
    return apiClient.request('/api/users')
  },
}
