import { apiClient } from './client'
import type { SafeUser } from '../types'

export type LoginResponse = { user: SafeUser }
export type MeResponse = { user: SafeUser }

export const authApi = {
  login(email: string, password: string) {
    apiClient.bumpFreshDataEpoch()
    return apiClient.request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },
  logout() {
    apiClient.bumpFreshDataEpoch()
    return apiClient.request<{ success: boolean }>('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) })
  },
  me() {
    return apiClient.request<MeResponse>('/api/auth/me')
  },
}
