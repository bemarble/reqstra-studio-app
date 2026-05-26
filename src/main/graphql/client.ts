import * as yaml from 'yaml'
import { GraphQLClient, ClientError } from 'graphql-request'
import { getIntrospectionQuery } from 'graphql'
import type { GraphQLAuth, GraphQLRequestParams, GraphQLResponse } from '../../shared/types/ipc'

export function parseGraphQLCaseFile(raw: string): {
  query: string
  variables: Record<string, unknown>
  headers: Record<string, string>
  auth: GraphQLAuth
} {
  if (!raw.trim()) {
    return { query: '', variables: {}, headers: {}, auth: { type: 'none' } }
  }
  try {
    const parsed = yaml.parse(raw) as Record<string, unknown>
    const query = typeof parsed.query === 'string' ? parsed.query : ''
    const variables =
      typeof parsed.variables === 'object' && parsed.variables !== null
        ? (parsed.variables as Record<string, unknown>)
        : {}
    const headers =
      typeof parsed.headers === 'object' && parsed.headers !== null
        ? (parsed.headers as Record<string, string>)
        : {}
    const auth = parseAuth(parsed.auth)
    return { query, variables, headers, auth }
  } catch {
    return { query: '', variables: {}, headers: {}, auth: { type: 'none' } }
  }
}

function parseAuth(raw: unknown): GraphQLAuth {
  if (typeof raw !== 'object' || raw === null) return { type: 'none' }
  const a = raw as Record<string, unknown>
  const type = (a.type as GraphQLAuth['type']) ?? 'none'
  return {
    type,
    token: typeof a.token === 'string' ? a.token : undefined,
    username: typeof a.username === 'string' ? a.username : undefined,
    password: typeof a.password === 'string' ? a.password : undefined,
  }
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

export async function executeGraphQLRequest(
  params: GraphQLRequestParams,
): Promise<GraphQLResponse> {
  const start = Date.now()

  const allHeaders: Record<string, string> = { ...params.headers }
  const authHeader = buildAuthHeader(params.auth)
  if (authHeader) allHeaders['Authorization'] = authHeader

  let parsedVariables: Record<string, unknown> = {}
  if (params.variables.trim()) {
    try {
      parsedVariables = (yaml.parse(params.variables) as Record<string, unknown>) ?? {}
    } catch {
      // 不正なYAMLは空オブジェクトで続行
    }
  }

  try {
    const client = new GraphQLClient(params.url, { headers: allHeaders })
    const data = await client.request(params.query, parsedVariables)
    return {
      status: 'OK',
      data,
      errors: [],
      httpStatus: 200,
      durationMs: Date.now() - start,
    }
  } catch (e) {
    if (e instanceof ClientError) {
      const resp = e.response
      return {
        status: 'ERROR',
        data: resp.data ?? null,
        errors: (resp.errors as unknown[]) ?? [],
        httpStatus: resp.status,
        durationMs: Date.now() - start,
        error: e.message,
      }
    }
    return {
      status: 'ERROR',
      data: null,
      errors: [],
      httpStatus: 0,
      durationMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

export async function introspectSchema(
  url: string,
  headers: Record<string, string>,
  auth: GraphQLAuth,
): Promise<string> {
  const allHeaders: Record<string, string> = { ...headers }
  const authHeader = buildAuthHeader(auth)
  if (authHeader) allHeaders['Authorization'] = authHeader

  const client = new GraphQLClient(url, { headers: allHeaders })
  const data = await client.request(getIntrospectionQuery())
  return JSON.stringify(data, null, 2)
}
