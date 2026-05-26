import * as yaml from 'yaml'
import type { HttpRequestParams, HttpResponse } from '../../shared/types/ipc'
import type { GraphQLAuth } from '../../shared/types/project'

export function buildUrl(
  baseUrl: string,
  path: string,
  pathParams: Record<string, string>,
  queryParams: Record<string, string>,
): string {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl

  let resolvedPath = path
  for (const [key, value] of Object.entries(pathParams)) {
    resolvedPath = resolvedPath.replace(`:${key}`, encodeURIComponent(value))
  }

  const entries = Object.entries(queryParams).filter(([, v]) => v !== '')
  if (entries.length > 0) {
    const qs = new URLSearchParams(entries).toString()
    return `${base}${resolvedPath}?${qs}`
  }

  return `${base}${resolvedPath}`
}

export function buildAuthHeader(auth: GraphQLAuth): string | null {
  switch (auth.type) {
    case 'bearer':
      return auth.token ? `Bearer ${auth.token}` : null
    case 'basic': {
      if (!auth.username) return null
      const credentials = Buffer.from(`${auth.username}:${auth.password ?? ''}`).toString('base64')
      return `Basic ${credentials}`
    }
    case 'oauth2':
      return auth.token ? `Bearer ${auth.token}` : null
    default:
      return null
  }
}

export function parseHttpCaseFile(raw: string): {
  body: string
  pathParams: Record<string, string>
  queryParams: Record<string, string>
} {
  if (!raw.trim()) return { body: '', pathParams: {}, queryParams: {} }
  try {
    const parsed = yaml.parse(raw) as Record<string, unknown>
    const body = typeof parsed.body === 'string' ? parsed.body : ''
    const pathParams =
      typeof parsed.pathParams === 'object' && parsed.pathParams !== null
        ? (parsed.pathParams as Record<string, string>)
        : {}
    const queryParams =
      typeof parsed.params === 'object' && parsed.params !== null
        ? (parsed.params as Record<string, string>)
        : {}
    return { body, pathParams, queryParams }
  } catch {
    return { body: '', pathParams: {}, queryParams: {} }
  }
}

export function serializeHttpCaseFile(
  body: string,
  queryParams: Record<string, string>,
  pathParams: Record<string, string>,
  bodyType: 'json' | 'query',
): string {
  const obj: Record<string, unknown> = {}
  if (bodyType === 'json' && body.trim()) obj.body = body
  if (bodyType === 'query' && Object.keys(queryParams).length > 0) obj.params = queryParams
  if (Object.keys(pathParams).length > 0) obj.pathParams = pathParams
  return yaml.stringify(obj)
}

export async function executeHttpRequest(params: HttpRequestParams): Promise<HttpResponse> {
  const start = Date.now()

  const url = buildUrl(
    params.baseUrl,
    params.path,
    params.pathParams,
    params.bodyType === 'query' ? params.queryParams : {},
  )

  const allHeaders: Record<string, string> = { ...params.headers }
  const authHeader = buildAuthHeader(params.auth)
  if (authHeader) allHeaders['Authorization'] = authHeader

  const hasBody =
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(params.method) &&
    params.bodyType === 'json' &&
    params.body.trim().length > 0
  if (hasBody) allHeaders['Content-Type'] = 'application/json'

  const headersToRecord = (h: Headers): Record<string, string> => {
    const result: Record<string, string> = {}
    h.forEach((value, key) => { result[key] = value })
    return result
  }

  try {
    const response = await fetch(url, {
      method: params.method,
      headers: allHeaders,
      body: hasBody ? params.body : undefined,
    })
    const body = await response.text()
    return {
      status: 'OK',
      body,
      httpStatus: response.status,
      durationMs: Date.now() - start,
      requestHeaders: allHeaders,
      responseHeaders: headersToRecord(response.headers),
    }
  } catch (e) {
    return {
      status: 'ERROR',
      body: '',
      httpStatus: 0,
      durationMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
      requestHeaders: allHeaders,
    }
  }
}
