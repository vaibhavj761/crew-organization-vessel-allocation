const rawBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:8080'

type ApiErrorBody = { message?: string; details?: unknown }

export class ApiError extends Error {
  status: number
  details?: unknown
  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (!rawBaseUrl || rawBaseUrl === '/api') return normalizedPath
  const trimmedBaseUrl = rawBaseUrl.replace(/\/+$/, '')
  if (/^https?:\/\//i.test(trimmedBaseUrl)) return `${trimmedBaseUrl}${normalizedPath}`
  return `${trimmedBaseUrl.startsWith('/') ? trimmedBaseUrl : `/${trimmedBaseUrl}`}${normalizedPath}`
}

async function request<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  })

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json') ? await response.json().catch(() => null) : null
  if (!response.ok) {
    const body = (payload || {}) as ApiErrorBody
    const message = body.message
      || (response.status === 401 ? 'Session expired. Please log in again.' : response.status === 403 ? 'You do not have permission to perform this action.' : response.status === 422 ? 'The server rejected part of the submitted data.' : response.status >= 500 ? 'Could not connect to server.' : `Request failed (${response.status})`)
    throw new ApiError(response.status, message, body.details)
  }
  return (payload ?? ({} as T)) as T
}

export const apiClient = { request }
export { rawBaseUrl as baseUrl, buildApiUrl }
