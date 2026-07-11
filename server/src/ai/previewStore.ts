import { randomUUID } from 'node:crypto'
import type { AiPreviewRecord } from './types.js'

const ttlMs = 10 * 60 * 1000
const previews = new Map<string, AiPreviewRecord>()

function pruneExpired() {
  const now = Date.now()
  for (const [id, preview] of previews.entries()) {
    if (preview.expiresAt <= now) previews.delete(id)
  }
}

export function storeAiPreview(input: Omit<AiPreviewRecord, 'previewId' | 'expiresAt'>) {
  pruneExpired()
  const previewId = randomUUID()
  const record: AiPreviewRecord = {
    ...input,
    previewId,
    expiresAt: Date.now() + ttlMs,
  }
  previews.set(previewId, record)
  return record
}

export function getAiPreview(previewId: string) {
  pruneExpired()
  return previews.get(previewId) || null
}

export function deleteAiPreview(previewId: string) {
  previews.delete(previewId)
}
