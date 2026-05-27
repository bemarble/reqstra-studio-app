import { describe, it, expect } from 'vitest'
import { buildUrl, buildAuthHeader, parseHttpCaseFile } from '../../../src/main/http/client'

describe('buildUrl', () => {
  it('path params を置換する', () => {
    expect(buildUrl('http://localhost:3000', '/users/:id', { id: '123' }, {}))
      .toBe('http://localhost:3000/users/123')
  })

  it('複数の path params を置換する', () => {
    expect(
      buildUrl('http://localhost:3000', '/orgs/:org/users/:id', { org: 'acme', id: '42' }, {}),
    ).toBe('http://localhost:3000/orgs/acme/users/42')
  })

  it('query params を URL に付加する', () => {
    expect(buildUrl('http://localhost:3000', '/users', {}, { page: '1', limit: '10' }))
      .toBe('http://localhost:3000/users?page=1&limit=10')
  })

  it('path params と query params を両方処理する', () => {
    expect(
      buildUrl('http://localhost:3000', '/users/:id/posts', { id: '5' }, { sort: 'asc' }),
    ).toBe('http://localhost:3000/users/5/posts?sort=asc')
  })

  it('baseUrl の末尾スラッシュを除去する', () => {
    expect(buildUrl('http://localhost:3000/', '/users', {}, {}))
      .toBe('http://localhost:3000/users')
  })

  it('空の queryParams は付加しない', () => {
    expect(buildUrl('http://localhost:3000', '/users', {}, {}))
      .toBe('http://localhost:3000/users')
  })
})

describe('buildAuthHeader', () => {
  it('none の場合 null を返す', () => {
    expect(buildAuthHeader({ type: 'none' })).toBeNull()
  })

  it('bearer トークンを返す', () => {
    expect(buildAuthHeader({ type: 'bearer', token: 'mytoken' })).toBe('Bearer mytoken')
  })

  it('bearer でトークンが空の場合 null を返す', () => {
    expect(buildAuthHeader({ type: 'bearer', token: '' })).toBeNull()
  })

  it('basic 認証ヘッダーを返す', () => {
    const header = buildAuthHeader({ type: 'basic', username: 'user', password: 'pass' })
    expect(header).toBe(`Basic ${Buffer.from('user:pass').toString('base64')}`)
  })

  it('basic でユーザー名が空の場合 null を返す', () => {
    expect(buildAuthHeader({ type: 'basic', username: '' })).toBeNull()
  })

  it('oauth2 はトークンを Bearer として返す', () => {
    expect(buildAuthHeader({ type: 'oauth2', token: 'tok' })).toBe('Bearer tok')
  })
})

describe('parseHttpCaseFile', () => {
  it('空文字列の場合デフォルト値を返す', () => {
    expect(parseHttpCaseFile('')).toEqual({ body: '', pathParams: {}, queryParams: {} })
  })

  it('json body を読み込む', () => {
    const result = parseHttpCaseFile('body: \'{"name":"Alice"}\'')
    expect(result.body).toBe('{"name":"Alice"}')
  })

  it('pathParams を読み込む', () => {
    const result = parseHttpCaseFile('pathParams:\n  id: "123"')
    expect(result.pathParams).toEqual({ id: '123' })
  })

  it('query params (params キー) を読み込む', () => {
    const result = parseHttpCaseFile('params:\n  page: "1"\n  limit: "10"')
    expect(result.queryParams).toEqual({ page: '1', limit: '10' })
  })

  it('不正な YAML の場合デフォルト値を返す', () => {
    expect(parseHttpCaseFile('{')).toEqual({ body: '', pathParams: {}, queryParams: {} })
  })
})
