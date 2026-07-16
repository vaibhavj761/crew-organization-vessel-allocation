import { apiClient } from './client'
import type { AiPreviewResponse, AiScope, AiStatusResponse } from '../types'

export const aiApi = {
  getStatus() {
    return apiClient.request<AiStatusResponse>('/api/ai/status')
  },
  generatePreview(prompt: string, scope: AiScope = 'auto') {
    return apiClient.request<AiPreviewResponse>('/api/ai/preview', {
      method: 'POST',
      body: JSON.stringify({ prompt, scope }),
    })
  },
  confirmPreview(previewId: string) {
    return apiClient.request<{ status: 'success'; message: string; updatedEntity: { type: string; id: string; name: string; items?: Array<{ type: string; id: string; name: string }> } }>('/api/ai/confirm', {
      method: 'POST',
      body: JSON.stringify({ previewId }),
    })
  },
}
