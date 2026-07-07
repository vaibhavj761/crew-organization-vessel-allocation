const rawBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:8080'
const inflightGetRequests = new Map<string, Promise<unknown>>()
let freshDataEpoch = Date.now()

function clearGetRequestCache() {
  inflightGetRequests.clear()
}

function bumpFreshDataEpoch() {
  freshDataEpoch = Date.now()
  clearGetRequestCache()
}

type ApiErrorBody = { message?: string; details?: unknown }
type AuthInvalidationDetail = { message: string }

export class ApiError extends Error {
  status: number
  details?: unknown
  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

function notifyAuthInvalidation(message: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<AuthInvalidationDetail>('crew-auth-invalidated', { detail: { message } }))
}

function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (!rawBaseUrl || rawBaseUrl === '/api') return normalizedPath
  const trimmedBaseUrl = rawBaseUrl.replace(/\/+$/, '')
  if (/^https?:\/\//i.test(trimmedBaseUrl)) return `${trimmedBaseUrl}${normalizedPath}`
  return `${trimmedBaseUrl.startsWith('/') ? trimmedBaseUrl : `/${trimmedBaseUrl}`}${normalizedPath}`
}

type RequestOptions = RequestInit & {
  fresh?: boolean
}

function withFreshQuery(url: string, fresh: boolean) {
  if (!fresh) return url
  const absolute = /^https?:\/\//i.test(url) ? new URL(url) : new URL(url, window.location.origin)
  absolute.searchParams.set('ts', String(freshDataEpoch))
  return /^https?:\/\//i.test(url) ? absolute.toString() : `${absolute.pathname}${absolute.search}`
}

async function request<T>(path: string, init: RequestOptions = {}) {
  const method = (init.method || 'GET').toUpperCase()
  const url = withFreshQuery(buildApiUrl(path), Boolean(init.fresh && method === 'GET'))
  const cacheKey = `${method}:${url}:${typeof init.body === 'string' ? init.body : ''}`

  const execute = async () => {
    const response = await fetch(url, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.fresh && method === 'GET' ? { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } : {}),
        ...(init.headers || {}),
      },
    })

    const contentType = response.headers.get('content-type') || ''
    const payload = contentType.includes('application/json') ? await response.json().catch(() => null) : null
    if (!response.ok) {
      const body = (payload || {}) as ApiErrorBody & { code?: string }
      const message = body.message
        || (response.status === 401 && body.code === 'ROLE_CHANGED_RELOGIN_REQUIRED' ? 'Your access was updated. Please sign in again.'
          : response.status === 401 ? 'Session expired. Please log in again.'
          : response.status === 403 ? 'You do not have permission to perform this action.'
          : response.status === 422 ? 'The server rejected part of the submitted data.'
          : response.status === 429 ? 'Too many actions in a short time. Please wait a few seconds and try again.'
          : response.status >= 500 ? 'Could not connect to server.'
          : `Request failed (${response.status})`)
      if (response.status === 401 && body.code === 'ROLE_CHANGED_RELOGIN_REQUIRED') notifyAuthInvalidation(message)
      throw new ApiError(response.status, message, body.details)
    }
    return (payload ?? ({} as T)) as T
  }

  if (method === 'GET') {
    if (init.fresh) return execute()
    const existing = inflightGetRequests.get(cacheKey)
    if (existing) return existing as Promise<T>
    const pending = execute().finally(() => inflightGetRequests.delete(cacheKey))
    inflightGetRequests.set(cacheKey, pending)
    return pending as Promise<T>
  }

  bumpFreshDataEpoch()
  return execute()
}

export const apiClient = { request, clearGetRequestCache, bumpFreshDataEpoch }
export { rawBaseUrl as baseUrl, buildApiUrl }
