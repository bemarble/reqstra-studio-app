import { describe, it, expect } from 'vitest'
import {
  parseGraphQLCaseFile,
  buildAuthHeader,
} from '../../../src/main/graphql/client'
import type { GraphQLAuth } from '../../../src/shared/types/ipc'

describe('parseGraphQLCaseFile', () => {
  it('query・variables・headers・auth をパースする', () => {
    const raw = `
query: |
  query GetUser($id: ID!) {
    user(id: $id) { name }
  }
variables:
  id: "alice-123"
headers:
  X-Tenant: "acme"
auth:
  type: bearer
  token: "my-token"
`.trim()

    const result = parseGraphQLCaseFile(raw)
    expect(result.query).toContain('GetUser')
    expect(result.variables).toEqual({ id: 'alice-123' })
    expect(result.headers).toEqual({ 'X-Tenant': 'acme' })
    expect(result.auth).toEqual({ type: 'bearer', token: 'my-token' })
  })

  it('空文字は空のデフォルト値を返す', () => {
    const result = parseGraphQLCaseFile('')
    expect(result.query).toBe('')
    expect(result.variables).toEqual({})
    expect(result.headers).toEqual({})
    expect(result.auth).toEqual({ type: 'none' })
  })

  it('variables・headers・auth がない場合もクラッシュしない', () => {
    const raw = 'query: "{ users { id } }"'
    const result = parseGraphQLCaseFile(raw)
    expect(result.query).toBe('{ users { id } }')
    expect(result.variables).toEqual({})
  })
})

describe('buildAuthHeader', () => {
  it('bearer: Bearer トークンを返す', () => {
    const auth: GraphQLAuth = { type: 'bearer', token: 'my-token' }
    expect(buildAuthHeader(auth)).toBe('Bearer my-token')
  })

  it('bearer: token が空の場合 null を返す', () => {
    const auth: GraphQLAuth = { type: 'bearer', token: '' }
    expect(buildAuthHeader(auth)).toBeNull()
  })

  it('basic: Base64エンコードされた Basic ヘッダーを返す', () => {
    const auth: GraphQLAuth = { type: 'basic', username: 'admin', password: 'secret' }
    const expected = `Basic ${Buffer.from('admin:secret').toString('base64')}`
    expect(buildAuthHeader(auth)).toBe(expected)
  })

  it('basic: username が空の場合 null を返す', () => {
    const auth: GraphQLAuth = { type: 'basic', username: '' }
    expect(buildAuthHeader(auth)).toBeNull()
  })

  it('oauth2: Bearer トークンを返す', () => {
    const auth: GraphQLAuth = { type: 'oauth2', token: 'oauth-token' }
    expect(buildAuthHeader(auth)).toBe('Bearer oauth-token')
  })

  it('none: null を返す', () => {
    const auth: GraphQLAuth = { type: 'none' }
    expect(buildAuthHeader(auth)).toBeNull()
  })
})
