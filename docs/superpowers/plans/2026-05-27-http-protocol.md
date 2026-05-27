# HTTP プロトコル実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reqstra Studio に HTTP プロトコルサポートを追加し、GraphQL と同等の機能（コレクション管理・ケース管理・リクエスト送信・レスポンス表示）を実現する

**Architecture:** 完全独立実装（アプローチA）。GraphQL と同じ「コレクション = 1エンドポイント」構造。コレクションに method/path/bodyType/headers/auth を保持し、ケースには body または query params と path params の値を YAML で保存する。

**Tech Stack:** Electron IPC、Node.js `fetch`、React 18、Zustand、Monaco Editor、yaml、TailwindCSS

---

## ファイル変更一覧

| ファイル | 変更種別 |
|---|---|
| `src/shared/types/project.ts` | 修正（HttpMethod, HttpBodyType, HttpEndpoint 追加） |
| `src/shared/types/ipc.ts` | 修正（HttpRequestParams, HttpResponse, IpcApi.httpRequest 追加） |
| `src/renderer/src/store/projectStore.ts` | 修正（HttpEndpoint インポート・型追加） |
| `src/main/http/client.ts` | 新規 |
| `tests/main/http/client.test.ts` | 新規 |
| `src/main/ipc/http.ts` | 新規 |
| `src/main/ipc/index.ts` | 修正（registerHttpHandlers 登録） |
| `src/preload/index.ts` | 修正（httpRequest 追加） |
| `src/renderer/src/components/modals/HttpEndpointModal.tsx` | 新規 |
| `src/renderer/src/components/Sidebar/CollectionTree.tsx` | 修正（HTTP 対応） |
| `src/renderer/src/components/MainPanel/HttpPanel/ResponseViewer.tsx` | 新規 |
| `src/renderer/src/components/MainPanel/HttpPanel/RequestEditor.tsx` | 新規 |
| `src/renderer/src/components/MainPanel/HttpPanel/index.tsx` | 新規 |
| `src/renderer/src/components/MainPanel/index.tsx` | 修正（HttpPanel 追加） |

---

## Task 1: 型定義の追加

**Files:**
- Modify: `src/shared/types/project.ts`
- Modify: `src/shared/types/ipc.ts`
- Modify: `src/renderer/src/store/projectStore.ts`

- [ ] **Step 1: `src/shared/types/project.ts` に HTTP 型を追加**

ファイル末尾の `HttpTarget` の下に追記し、`Collection.endpoints` の型を拡張する。

```ts
// 既存の HttpTarget の下に追加
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type HttpBodyType = 'json' | 'query'

export interface HttpEndpoint {
  id: string
  name: string
  method: HttpMethod
  path: string           // e.g. "/users/:id"
  bodyType: HttpBodyType
  casesDir: string       // "requests/http/<name>"
  headers?: Record<string, string>
  auth?: GraphQLAuth
}
```

`Collection` インターフェースの `endpoints` を変更:
```ts
export interface Collection {
  id: string
  protocol: 'grpc' | 'graphql' | 'http'
  name: string
  protocolTargetId: string
  endpoints: GrpcEndpoint[] | GraphQLEndpoint[] | HttpEndpoint[]
}
```

- [ ] **Step 2: `src/shared/types/ipc.ts` に HTTP IPC 型を追加**

既存の `GraphQLResponse` の下に追記し、`IpcApi` にメソッドを追加する。

```ts
// GraphQLResponse の下に追加
export interface HttpRequestParams {
  baseUrl: string
  method: HttpMethod
  path: string
  pathParams: Record<string, string>
  headers: Record<string, string>
  auth: GraphQLAuth
  bodyType: HttpBodyType
  body: string                        // bodyType=json のときの JSON 文字列（bodyType=query のときは空文字）
  queryParams: Record<string, string> // bodyType=query のときのパラメータ
}

export interface HttpResponse {
  status: 'OK' | 'ERROR'
  body: string
  httpStatus: number
  durationMs: number
  error?: string
  requestHeaders?: Record<string, string>
  responseHeaders?: Record<string, string>
}
```

`import type` の 1 行目を修正してインポートを追加:
```ts
import type { ReqstraProject, GraphQLAuth, GraphQLAuthType, HttpMethod, HttpBodyType } from './project'

export type { GraphQLAuth, GraphQLAuthType }
```

`IpcApi` インターフェースに追加:
```ts
httpRequest: (params: HttpRequestParams) => Promise<HttpResponse>
```

- [ ] **Step 3: `src/renderer/src/store/projectStore.ts` の型を更新**

インポート行に `HttpEndpoint` を追加:
```ts
import type {
  ReqstraProject,
  Collection,
  Environment,
  GrpcTarget,
  HttpTarget,
  GraphQLTarget,
  GrpcEndpoint,
  GraphQLEndpoint,
  HttpEndpoint,
} from '../../../shared/types/project'
```

`addEndpoint` / `updateEndpoint` / `deleteEndpoint` の型シグネチャを変更:
```ts
addEndpoint: (collectionId: string, endpoint: GrpcEndpoint | GraphQLEndpoint | HttpEndpoint) => void
updateEndpoint: (collectionId: string, endpoint: GrpcEndpoint | GraphQLEndpoint | HttpEndpoint) => void
```

`ProjectState` インターフェースの同名フィールドも同様に変更する。

- [ ] **Step 4: 型チェックを実行**

```bash
cd /Users/mktkbys/Documents/workspace/reqstra-studio && npx tsc --noEmit
```

エラーがないことを確認する。

- [ ] **Step 5: コミット**

```bash
git add src/shared/types/project.ts src/shared/types/ipc.ts src/renderer/src/store/projectStore.ts
git commit -m "feat: HTTP プロトコルの型定義を追加"
```

---

## Task 2: Main Process — HTTP クライアント（TDD）

**Files:**
- Create: `tests/main/http/client.test.ts`
- Create: `src/main/http/client.ts`

- [ ] **Step 1: テストファイルを作成**

```ts
// tests/main/http/client.test.ts
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
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
cd /Users/mktkbys/Documents/workspace/reqstra-studio && npm run test -- --project main tests/main/http/client.test.ts
```

期待出力: `FAIL` (ファイルが存在しないため)

- [ ] **Step 3: `src/main/http/client.ts` を実装**

```ts
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
```

- [ ] **Step 4: テストを実行して確認**

```bash
cd /Users/mktkbys/Documents/workspace/reqstra-studio && npm run test -- --project main tests/main/http/client.test.ts
```

期待出力: 全テストが `PASS`

- [ ] **Step 5: コミット**

```bash
git add tests/main/http/client.test.ts src/main/http/client.ts
git commit -m "test: HTTP クライアントのユニットテストを追加し実装する"
```

---

## Task 3: Main Process — IPC ハンドラーと preload

**Files:**
- Create: `src/main/ipc/http.ts`
- Modify: `src/main/ipc/index.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: `src/main/ipc/http.ts` を作成**

```ts
import { ipcMain } from 'electron'
import { executeHttpRequest } from '../http/client'
import type { HttpRequestParams } from '../../shared/types/ipc'

export function registerHttpHandlers(): void {
  ipcMain.handle('http:request', async (_event, params: HttpRequestParams) => {
    return executeHttpRequest(params)
  })
}
```

- [ ] **Step 2: `src/main/ipc/index.ts` に登録を追加**

既存の `registerGraphQLHandlers()` の下に追記:
```ts
import { registerHttpHandlers } from './http'
// ... registerAllHandlers 内の末尾に追加
registerHttpHandlers()
```

- [ ] **Step 3: `src/preload/index.ts` に httpRequest を追加**

既存の `graphqlIntrospect` の下に追記:
```ts
httpRequest: (params) => ipcRenderer.invoke('http:request', params),
```

- [ ] **Step 4: 型チェックを実行**

```bash
cd /Users/mktkbys/Documents/workspace/reqstra-studio && npx tsc --noEmit
```

エラーがないことを確認する。

- [ ] **Step 5: コミット**

```bash
git add src/main/ipc/http.ts src/main/ipc/index.ts src/preload/index.ts
git commit -m "feat: HTTP IPC ハンドラーを追加し preload に公開する"
```

---

## Task 4: UI — HttpEndpointModal

**Files:**
- Create: `src/renderer/src/components/modals/HttpEndpointModal.tsx`

HTTP コレクションを追加するときに使うモーダル。name / protocolTargetId / method / path / bodyType を入力して Collection (with HttpEndpoint) を返す。

- [ ] **Step 1: `src/renderer/src/components/modals/HttpEndpointModal.tsx` を作成**

```tsx
import { useState, type JSX } from 'react'
import type { Collection, HttpEndpoint, HttpMethod, HttpBodyType, Environment } from '../../../../shared/types/project'

interface Props {
  mode: 'add' | 'edit'
  initial?: Collection
  environment: Environment | undefined
  onSubmit: (col: Collection) => void
  onClose: () => void
  isSubmitting?: boolean
}

function getTargets(environment: Environment | undefined): Array<{ id: string; name: string }> {
  return (environment?.protocols.http as Array<{ id: string; name: string }> | undefined) ?? []
}

export function HttpEndpointModal({
  mode,
  initial,
  environment,
  onSubmit,
  onClose,
  isSubmitting,
}: Props): JSX.Element {
  const existingEndpoint = initial?.endpoints[0] as HttpEndpoint | undefined
  const httpTargets = getTargets(environment)

  const [name, setName] = useState<string>(initial?.name ?? '')
  const [protocolTargetId, setProtocolTargetId] = useState<string>(
    initial?.protocolTargetId ?? httpTargets[0]?.id ?? '',
  )
  const [method, setMethod] = useState<HttpMethod>(existingEndpoint?.method ?? 'GET')
  const [path, setPath] = useState<string>(existingEndpoint?.path ?? '/')
  const [bodyType, setBodyType] = useState<HttpBodyType>(existingEndpoint?.bodyType ?? 'json')

  const isValid = name.trim().length > 0 && path.trim().length > 0

  const handleSubmit = (): void => {
    if (!isValid) return
    const trimmedName = name.trim()
    const endpoint: HttpEndpoint = {
      id: existingEndpoint?.id ?? crypto.randomUUID(),
      name: trimmedName,
      method,
      path: path.trim(),
      bodyType,
      casesDir: `requests/http/${trimmedName}`,
      headers: existingEndpoint?.headers,
      auth: existingEndpoint?.auth,
    }
    onSubmit({
      id: initial?.id ?? crypto.randomUUID(),
      protocol: 'http',
      name: trimmedName,
      protocolTargetId,
      endpoints: [endpoint],
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-96 rounded bg-[var(--color-bg-secondary)] p-4 shadow-xl">
        <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
          {mode === 'add' ? 'HTTP エンドポイントを追加' : 'HTTP エンドポイントを編集'}
        </h2>

        <div className="mb-3">
          <label htmlFor="http-name" className="mb-1 block text-xs text-[var(--color-text-secondary)]">
            名前
          </label>
          <input
            id="http-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: Create User"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            className="w-full rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-accent)]"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="http-target" className="mb-1 block text-xs text-[var(--color-text-secondary)]">
            ターゲット
          </label>
          <select
            id="http-target"
            value={protocolTargetId}
            onChange={(e) => setProtocolTargetId(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none"
          >
            {httpTargets.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
            {httpTargets.length === 0 && <option value="">ターゲット未設定</option>}
          </select>
        </div>

        <div className="mb-3 flex gap-2">
          <div className="w-28">
            <label htmlFor="http-method" className="mb-1 block text-xs text-[var(--color-text-secondary)]">
              メソッド
            </label>
            <select
              id="http-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as HttpMethod)}
              className="w-full rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none"
            >
              {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as HttpMethod[]).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor="http-path" className="mb-1 block text-xs text-[var(--color-text-secondary)]">
              パス
            </label>
            <input
              id="http-path"
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/users/:id"
              className="w-full rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-accent)]"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
            ボディタイプ
          </label>
          <div className="flex gap-3">
            {(['json', 'query'] as HttpBodyType[]).map((bt) => (
              <label key={bt} className="flex cursor-pointer items-center gap-1.5 text-xs text-[var(--color-text-primary)]">
                <input
                  type="radio"
                  value={bt}
                  checked={bodyType === bt}
                  onChange={() => setBodyType(bt)}
                  className="accent-[var(--color-text-accent)]"
                />
                {bt === 'json' ? 'JSON' : 'Query Params'}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-[#3c3c3c] px-3 py-1 text-xs text-[var(--color-text-primary)] hover:bg-[#4c4c4c]"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || !!isSubmitting}
            className="rounded bg-[var(--color-bg-active)] px-3 py-1 text-xs text-white disabled:opacity-50"
          >
            {mode === 'add' ? '追加' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 型チェック**

```bash
cd /Users/mktkbys/Documents/workspace/reqstra-studio && npx tsc --noEmit
```

- [ ] **Step 3: コミット**

```bash
git add src/renderer/src/components/modals/HttpEndpointModal.tsx
git commit -m "feat: HTTP エンドポイント追加モーダルを実装する"
```

---

## Task 5: UI — CollectionTree への HTTP 対応

**Files:**
- Modify: `src/renderer/src/components/Sidebar/CollectionTree.tsx`

HTTP コレクションを GraphQL 式（ケースをコレクション直下に表示）で扱う。モーダルを `HttpEndpointModal` に切り替える。

- [ ] **Step 1: インポートに `HttpEndpoint` と `HttpEndpointModal` を追加**

ファイル先頭のインポートを変更:
```ts
import type { Collection, GrpcEndpoint, GrpcTarget, GraphQLEndpoint, HttpEndpoint } from '../../../../shared/types/project'
import { CollectionModal } from '../modals/CollectionModal'
import { EndpointModal } from '../modals/EndpointModal'
import { GraphQLEndpointModal } from '../modals/GraphQLEndpointModal'
import { HttpEndpointModal } from '../modals/HttpEndpointModal'
```

- [ ] **Step 2: `toggleCollection` に HTTP 処理を追加**

現在のコード:
```ts
const toggleCollection = async (id: string): Promise<void> => {
  if (!expandedCollections.has(id) && project) {
    const col = collections.find((c) => c.id === id)
    if (col?.protocol === 'graphql') {
      const ep = col.endpoints[0]
      if (ep) {
        const casesAbsDir = path.join(project.projectDir, ep.casesDir)
        const cases = await window.reqstraApi.listCases(casesAbsDir)
        setCasesForEndpoint(ep.id, cases)
      }
    }
  }
```

変更後（`graphql` の条件の後に `http` を追加）:
```ts
const toggleCollection = async (id: string): Promise<void> => {
  if (!expandedCollections.has(id) && project) {
    const col = collections.find((c) => c.id === id)
    if (col?.protocol === 'graphql' || col?.protocol === 'http') {
      const ep = col.endpoints[0]
      if (ep) {
        const casesAbsDir = path.join(project.projectDir, ep.casesDir)
        const cases = await window.reqstraApi.listCases(casesAbsDir)
        setCasesForEndpoint(ep.id, cases)
      }
    }
  }
```

- [ ] **Step 3: コレクションクリック時の HTTP 処理を追加**

コレクション行の `onClick` 内（現在 `graphql` の場合のみタブを開いている）を変更:
```ts
onClick={() => {
  void toggleCollection(col.id)
  if (col.protocol === 'graphql' || col.protocol === 'http') {
    const ep = col.endpoints[0]
    if (ep) {
      openTab({ type: 'scratch', id: `scratch::${ep.id}`, label: col.name, endpointId: ep.id })
    }
  }
}}
```

- [ ] **Step 4: HTTP コレクションの ＋ ボタン（ケース追加）を追加**

コレクション行のアクションボタン部分。現在は `graphql` と `grpc/http` で分岐している:
```tsx
{(col.protocol === 'graphql' || col.protocol === 'http') && (
  <button
    type="button"
    onClick={() => {
      const ep = col.endpoints[0]
      if (!ep || !project) return
      const casesAbsDir = path.join(project.projectDir, ep.casesDir)
      void (async () => {
        const existingCases = await window.reqstraApi.listCases(casesAbsDir)
        const caseName = getAvailableCaseName(existingCases)
        await window.reqstraApi.writeCase(path.join(casesAbsDir, caseName), '')
        const updatedCases = await window.reqstraApi.listCases(casesAbsDir)
        setCasesForEndpoint(ep.id, updatedCases)
        setExpandedCollections((prev) => new Set([...prev, col.id]))
        openTab({
          type: 'case',
          id: `${ep.id}::${caseName}`,
          label: `${col.name} / ${caseName.replace(/\.yaml$/, '')}`,
          endpointId: ep.id,
          caseName,
        })
      })()
    }}
    title="ケースを作成"
    className="rounded px-1.5 py-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
  >
    ＋
  </button>
)}
{col.protocol !== 'grpc' && col.protocol !== 'graphql' && col.protocol !== 'http' && (
  <button
    type="button"
    onClick={() => setModalState({ type: 'add-endpoint', collectionId: col.id })}
    title="エンドポイントを追加"
    className="rounded px-1.5 py-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
  >
    ＋
  </button>
)}
```

- [ ] **Step 5: HTTP コレクションのケース一覧表示を追加**

コレクション展開部分（現在は `graphql` のみケース直下表示）を変更:
```tsx
{expandedCollections.has(col.id) && (col.protocol === 'graphql' || col.protocol === 'http') && (() => {
  const ep = col.endpoints[0]
  if (!ep) return null
  return (casesByEndpoint[ep.id] ?? []).map((caseName) => (
    // ... 既存の graphql ケース表示と同じ Fragment
  ))
})()}
```

- [ ] **Step 6: `handleCollectionSubmit` に HTTP 分岐を追加**

```ts
const handleCollectionSubmit = async (col: Collection): Promise<void> => {
  setIsSubmitting(true)
  try {
    if (modalState?.type === 'add-collection') {
      if (col.protocol === 'graphql') {
        const autoEndpoint: GraphQLEndpoint = {
          id: crypto.randomUUID(),
          name: col.name,
          casesDir: `requests/graphql/${col.name}`,
        }
        addCollection({ ...col, endpoints: [autoEndpoint] })
      } else if (col.protocol === 'http') {
        // HttpEndpointModal が endpoints を含む Collection を返すのでそのまま追加
        addCollection(col)
      } else {
        addCollection(col)
      }
    } else {
      updateCollection(col)
    }
    if (await persistProject()) setModalState(null)
  } finally {
    setIsSubmitting(false)
  }
}
```

- [ ] **Step 7: 削除ボタンの条件に HTTP を追加**

現在の `col.protocol !== 'grpc'` 条件（削除ボタン表示）はそのまま HTTP を含むので変更不要。

- [ ] **Step 8: モーダル表示分岐に HTTP を追加**

`return (` の末尾付近にある `CollectionModal` レンダリング部分の後に追加:
```tsx
{modalState?.type === 'add-collection' && activeProtocol === 'http' && (
  <HttpEndpointModal
    mode="add"
    environment={activeEnv}
    isSubmitting={isSubmitting}
    onSubmit={handleCollectionSubmit}
    onClose={() => setModalState(null)}
  />
)}
{modalState?.type === 'edit-collection' && activeProtocol === 'http' && (
  <HttpEndpointModal
    mode="edit"
    initial={modalState.collection}
    environment={activeEnv}
    isSubmitting={isSubmitting}
    onSubmit={handleCollectionSubmit}
    onClose={() => setModalState(null)}
  />
)}
```

`CollectionModal` の表示条件を HTTP を除外するよう変更:
```tsx
{modalState?.type === 'add-collection' && activeProtocol !== 'http' && (
  <CollectionModal ... />
)}
{modalState?.type === 'edit-collection' && activeProtocol !== 'http' && (
  <CollectionModal ... />
)}
```

- [ ] **Step 9: 型チェック**

```bash
cd /Users/mktkbys/Documents/workspace/reqstra-studio && npx tsc --noEmit
```

- [ ] **Step 10: コミット**

```bash
git add src/renderer/src/components/Sidebar/CollectionTree.tsx
git commit -m "feat: CollectionTree に HTTP プロトコルのサポートを追加する"
```

---

## Task 6: UI — HttpPanel/ResponseViewer

**Files:**
- Create: `src/renderer/src/components/MainPanel/HttpPanel/ResponseViewer.tsx`

- [ ] **Step 1: `src/renderer/src/components/MainPanel/HttpPanel/ResponseViewer.tsx` を作成**

```tsx
import { useState, type JSX } from 'react'
import { MonacoEditor } from '../../shared/MonacoEditor'
import type { HttpResponse } from '../../../../../shared/types/ipc'

interface Props {
  response: HttpResponse | null
  isLoading: boolean
}

type ResponseTab = 'body' | 'request-headers' | 'response-headers'

function HeadersTable({ headers }: { headers: Record<string, string> }): JSX.Element {
  const entries = Object.entries(headers)
  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-[var(--color-text-secondary)]">
        ヘッダーなし
      </div>
    )
  }
  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-[var(--color-bg-secondary)]">
          <tr className="border-b border-[var(--color-border)]">
            <th className="w-2/5 px-3 py-1.5 text-left font-medium text-[var(--color-text-secondary)]">Name</th>
            <th className="px-3 py-1.5 text-left font-medium text-[var(--color-text-secondary)]">Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]">
              <td className="px-3 py-1.5 font-mono text-[var(--color-text-accent)]">{key}</td>
              <td className="px-3 py-1.5 font-mono text-[var(--color-text-primary)] break-all">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function httpStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-[var(--color-success)]'
  if (status >= 400) return 'text-[var(--color-error)]'
  return 'text-[var(--color-text-secondary)]'
}

export function ResponseViewer({ response, isLoading }: Props): JSX.Element {
  const [activeTab, setActiveTab] = useState<ResponseTab>('body')

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">
        <span className="animate-pulse">送信中...</span>
      </div>
    )
  }

  if (!response) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-[var(--color-text-secondary)]">
        レスポンスなし
      </div>
    )
  }

  const isJson = (() => {
    try {
      JSON.parse(response.body)
      return true
    } catch {
      return false
    }
  })()

  const bodyForEditor = isJson
    ? JSON.stringify(JSON.parse(response.body) as unknown, null, 2)
    : response.body

  const tabs: { id: ResponseTab; label: string }[] = [
    { id: 'body', label: 'Body' },
    { id: 'request-headers', label: 'Request Headers' },
    { id: 'response-headers', label: 'Response Headers' },
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-1">
        <span
          className={`text-xs font-medium ${
            response.status === 'OK' ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'
          }`}
        >
          ●{' '}
          {response.httpStatus > 0 && (
            <span className={httpStatusColor(response.httpStatus)}>
              {response.httpStatus}
            </span>
          )}
          {response.httpStatus === 0 && response.status}
        </span>
        <span className="text-xs text-[var(--color-text-secondary)]">{response.durationMs}ms</span>
      </div>

      {response.error && (
        <div className="border-b border-[var(--color-border)] bg-[#2d1515] px-3 py-2 text-xs text-[var(--color-error)]">
          {response.error}
        </div>
      )}

      <div className="flex border-b border-[var(--color-border)] px-3 text-xs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`mr-4 py-1 ${
              activeTab === tab.id
                ? 'border-b-2 border-[var(--color-text-accent)] text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'body' && (
          <MonacoEditor
            value={bodyForEditor}
            language={isJson ? 'json' : 'plaintext'}
            readOnly
          />
        )}
        {activeTab === 'request-headers' && (
          <HeadersTable headers={response.requestHeaders ?? {}} />
        )}
        {activeTab === 'response-headers' && (
          <HeadersTable headers={response.responseHeaders ?? {}} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 型チェック**

```bash
cd /Users/mktkbys/Documents/workspace/reqstra-studio && npx tsc --noEmit
```

- [ ] **Step 3: コミット**

```bash
git add src/renderer/src/components/MainPanel/HttpPanel/ResponseViewer.tsx
git commit -m "feat: HTTP レスポンスビューアコンポーネントを実装する"
```

---

## Task 7: UI — HttpPanel/RequestEditor

**Files:**
- Create: `src/renderer/src/components/MainPanel/HttpPanel/RequestEditor.tsx`

- [ ] **Step 1: `src/renderer/src/components/MainPanel/HttpPanel/RequestEditor.tsx` を作成**

```tsx
import { useState, type JSX } from 'react'
import { MonacoEditor } from '../../shared/MonacoEditor'
import { MetadataEditor } from '../GrpcPanel/MetadataEditor'
import type { HttpMethod, HttpBodyType, GraphQLAuth } from '../../../../../shared/types/project'

type BottomTab = 'body' | 'path-params' | 'headers' | 'auth'

interface Props {
  method: HttpMethod
  path: string
  bodyType: HttpBodyType
  body: string
  queryParams: Record<string, string>
  pathParams: Record<string, string>
  headers: Record<string, string>
  auth: GraphQLAuth
  onMethodChange: (v: HttpMethod) => void
  onPathChange: (v: string) => void
  onBodyTypeChange: (v: HttpBodyType) => void
  onBodyChange: (v: string) => void
  onQueryParamsChange: (v: Record<string, string>) => void
  onPathParamsChange: (v: Record<string, string>) => void
  onHeadersChange: (v: Record<string, string>) => void
  onAuthChange: (v: GraphQLAuth) => void
}

function extractPathParamKeys(path: string): string[] {
  return [...path.matchAll(/:([^/]+)/g)].map((m) => m[1])
}

function methodColor(method: HttpMethod): string {
  switch (method) {
    case 'GET': return 'text-[#4ec9b0]'
    case 'POST': return 'text-[#4fc1ff]'
    case 'PUT': return 'text-[#dcdcaa]'
    case 'PATCH': return 'text-[#ce9178]'
    case 'DELETE': return 'text-[var(--color-error)]'
  }
}

export function RequestEditor({
  method,
  path,
  bodyType,
  body,
  queryParams,
  pathParams,
  headers,
  auth,
  onMethodChange,
  onPathChange,
  onBodyTypeChange,
  onBodyChange,
  onQueryParamsChange,
  onPathParamsChange,
  onHeadersChange,
  onAuthChange,
}: Props): JSX.Element {
  const [bottomTab, setBottomTab] = useState<BottomTab>('body')

  const pathParamKeys = extractPathParamKeys(path)
  const hasPathParams = pathParamKeys.length > 0

  const handlePathParamChange = (key: string, value: string): void => {
    onPathParamsChange({ ...pathParams, [key]: value })
  }

  const tabs: { id: BottomTab; label: string; show: boolean }[] = [
    { id: 'body', label: bodyType === 'json' ? 'Body' : 'Query Params', show: true },
    { id: 'path-params', label: 'Path Params', show: hasPathParams },
    { id: 'headers', label: 'Headers', show: true },
    { id: 'auth', label: 'Auth', show: true },
  ]

  return (
    <div className="flex h-full flex-col">
      {/* URL バー（コレクション設定） */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
        <select
          value={method}
          onChange={(e) => onMethodChange(e.target.value as HttpMethod)}
          className={`w-24 rounded bg-[#3c3c3c] px-2 py-1 text-xs font-medium outline-none ${methodColor(method)}`}
        >
          {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as HttpMethod[]).map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <input
          type="text"
          value={path}
          onChange={(e) => onPathChange(e.target.value)}
          placeholder="/users/:id"
          className="flex-1 rounded bg-[#3c3c3c] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-[var(--color-text-accent)]"
        />
        <select
          value={bodyType}
          onChange={(e) => onBodyTypeChange(e.target.value as HttpBodyType)}
          className="w-32 rounded bg-[#3c3c3c] px-2 py-1 text-xs text-[var(--color-text-secondary)] outline-none"
        >
          <option value="json">JSON Body</option>
          <option value="query">Query Params</option>
        </select>
      </div>

      {/* タブエリア */}
      <div className="flex border-b border-[var(--color-border)] px-3 text-xs">
        {tabs.filter((t) => t.show).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setBottomTab(tab.id)}
            className={`mr-4 py-1 ${
              bottomTab === tab.id
                ? 'border-b-2 border-[var(--color-text-accent)] text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* タブコンテンツ */}
      <div className="flex-1 overflow-hidden">
        {bottomTab === 'body' && bodyType === 'json' && (
          <MonacoEditor
            value={body}
            onChange={(v) => onBodyChange(v ?? '')}
            language="json"
          />
        )}
        {bottomTab === 'body' && bodyType === 'query' && (
          <MetadataEditor metadata={queryParams} onChange={onQueryParamsChange} />
        )}
        {bottomTab === 'path-params' && hasPathParams && (
          <div className="space-y-1 p-3 text-xs">
            {pathParamKeys.map((key) => (
              <div key={key} className="flex items-center gap-2">
                <span className="w-32 shrink-0 font-mono text-[var(--color-text-accent)]">:{key}</span>
                <input
                  value={pathParams[key] ?? ''}
                  onChange={(e) => handlePathParamChange(key, e.target.value)}
                  placeholder={`${key} の値`}
                  className="flex-1 rounded bg-[#3c3c3c] px-2 py-1 text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-[var(--color-text-accent)]"
                />
              </div>
            ))}
          </div>
        )}
        {bottomTab === 'headers' && (
          <MetadataEditor metadata={headers} onChange={onHeadersChange} />
        )}
        {bottomTab === 'auth' && (
          <AuthEditor auth={auth} onChange={onAuthChange} />
        )}
      </div>
    </div>
  )
}

interface AuthEditorProps {
  auth: GraphQLAuth
  onChange: (auth: GraphQLAuth) => void
}

function AuthEditor({ auth, onChange }: AuthEditorProps): JSX.Element {
  return (
    <div className="space-y-2 p-3 text-xs">
      <div className="flex items-center gap-2">
        <label className="w-20 shrink-0 text-[var(--color-text-secondary)]">タイプ</label>
        <select
          value={auth.type}
          onChange={(e) => onChange({ type: e.target.value as GraphQLAuth['type'] })}
          className="rounded bg-[#3c3c3c] px-2 py-1 text-[var(--color-text-primary)] outline-none"
        >
          <option value="none">None</option>
          <option value="bearer">Bearer Token</option>
          <option value="basic">Basic Auth</option>
          <option value="oauth2">OAuth2</option>
        </select>
      </div>

      {(auth.type === 'bearer' || auth.type === 'oauth2') && (
        <div className="flex items-center gap-2">
          <label className="w-20 shrink-0 text-[var(--color-text-secondary)]">Token</label>
          <input
            type="text"
            value={auth.token ?? ''}
            onChange={(e) => onChange({ ...auth, token: e.target.value })}
            placeholder="your-token"
            className="flex-1 rounded bg-[#3c3c3c] px-2 py-1 text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-[var(--color-text-accent)]"
          />
        </div>
      )}

      {auth.type === 'basic' && (
        <>
          <div className="flex items-center gap-2">
            <label className="w-20 shrink-0 text-[var(--color-text-secondary)]">Username</label>
            <input
              type="text"
              value={auth.username ?? ''}
              onChange={(e) => onChange({ ...auth, username: e.target.value })}
              placeholder="username"
              className="flex-1 rounded bg-[#3c3c3c] px-2 py-1 text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-[var(--color-text-accent)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="w-20 shrink-0 text-[var(--color-text-secondary)]">Password</label>
            <input
              type="password"
              value={auth.password ?? ''}
              onChange={(e) => onChange({ ...auth, password: e.target.value })}
              placeholder="password"
              className="flex-1 rounded bg-[#3c3c3c] px-2 py-1 text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-[var(--color-text-accent)]"
            />
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 型チェック**

```bash
cd /Users/mktkbys/Documents/workspace/reqstra-studio && npx tsc --noEmit
```

- [ ] **Step 3: コミット**

```bash
git add src/renderer/src/components/MainPanel/HttpPanel/RequestEditor.tsx
git commit -m "feat: HTTP リクエストエディタコンポーネントを実装する"
```

---

## Task 8: UI — HttpPanel/index.tsx

**Files:**
- Create: `src/renderer/src/components/MainPanel/HttpPanel/index.tsx`

- [ ] **Step 1: `src/renderer/src/components/MainPanel/HttpPanel/index.tsx` を作成**

```tsx
import { useState, useEffect, useCallback, useRef, type JSX } from 'react'
import * as yaml from 'yaml'
import { RequestEditor } from './RequestEditor'
import { ResponseViewer } from './ResponseViewer'
import { ResizablePanes } from '../../shared/ResizablePanes'
import { useAppStore, type Tab } from '../../../store/appStore'
import { useProjectStore } from '../../../store/projectStore'
import { parseHttpCaseFile, serializeHttpCaseFile } from '../../../../../main/http/client'
import type { HttpResponse, HttpRequestParams, LogEntry } from '../../../../../shared/types/ipc'
import type { HttpTarget, HttpEndpoint, HttpMethod, HttpBodyType, GraphQLAuth } from '../../../../../shared/types/project'
import * as path from 'path'

interface Props {
  tab: Tab
}

const DEFAULT_AUTH: GraphQLAuth = { type: 'none' }

export function HttpPanel({ tab }: Props): JSX.Element {
  const project = useProjectStore((s) => s.project)
  const updateEndpoint = useProjectStore((s) => s.updateEndpoint)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const activeProtocolTargetId = useAppStore((s) => s.activeProtocolTargetId)
  const setSaveStatus = useAppStore((s) => s.setSaveStatus)

  const endpoint = project?.collections
    .flatMap((c) => c.endpoints as HttpEndpoint[])
    .find((ep) => ep.id === tab.endpointId)

  const collection = project?.collections.find((c) =>
    (c.endpoints as HttpEndpoint[]).some((ep) => ep.id === tab.endpointId),
  )

  const activeEnv =
    project?.environments.find((e) => e.id === activeEnvironmentId) ?? project?.environments[0]
  const httpTargets = (activeEnv?.protocols?.http as HttpTarget[] | undefined) ?? []
  const activeTarget =
    httpTargets.find((t) => t.id === activeProtocolTargetId) ?? httpTargets[0]

  const endpointLabel = activeTarget?.baseUrl
    ? `${activeTarget.baseUrl}${endpoint?.path ?? ''}`
    : '(ターゲット未設定)'

  // エンドポイント設定（コレクション単位）
  const [method, setMethod] = useState<HttpMethod>(endpoint?.method ?? 'GET')
  const [epPath, setEpPath] = useState<string>(endpoint?.path ?? '/')
  const [bodyType, setBodyType] = useState<HttpBodyType>(endpoint?.bodyType ?? 'json')
  const [headers, setHeaders] = useState<Record<string, string>>(endpoint?.headers ?? {})
  const [auth, setAuth] = useState<GraphQLAuth>(endpoint?.auth ?? DEFAULT_AUTH)

  // ケース設定（ケース単位）
  const [body, setBody] = useState<string>('')
  const [queryParams, setQueryParams] = useState<Record<string, string>>({})
  const [pathParams, setPathParams] = useState<Record<string, string>>({})

  const [response, setResponse] = useState<HttpResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const endpointTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // エンドポイントが切り替わったとき
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setMethod(endpoint?.method ?? 'GET')
    setEpPath(endpoint?.path ?? '/')
    setBodyType(endpoint?.bodyType ?? 'json')
    setHeaders(endpoint?.headers ?? {})
    setAuth(endpoint?.auth ?? DEFAULT_AUTH)
  }, [endpoint?.id])

  // タブ（ケース）が切り替わったとき
  useEffect(() => {
    if (!project || !endpoint || tab.type !== 'case') {
      setBody('')
      setQueryParams({})
      setPathParams({})
      return
    }
    const filePath = path.join(project.projectDir, endpoint.casesDir, tab.caseName)
    window.reqstraApi
      .readCase(filePath)
      .then((raw) => {
        const parsed = parseHttpCaseFile(raw)
        setBody(parsed.body)
        setQueryParams(parsed.queryParams)
        setPathParams(parsed.pathParams)
      })
      .catch(() => {
        setBody('')
        setQueryParams({})
        setPathParams({})
      })
  }, [tab.id, project?.projectDir, endpoint?.id])

  const saveEndpointData = useCallback(
    (m: HttpMethod, p: string, bt: HttpBodyType, hdrs: Record<string, string>, a: GraphQLAuth): void => {
      if (!endpoint || !collection) return
      const updatedEndpoint: HttpEndpoint = {
        ...endpoint,
        method: m,
        path: p,
        bodyType: bt,
        headers: hdrs,
        auth: a,
      }
      updateEndpoint(collection.id, updatedEndpoint)
      const proj = useProjectStore.getState().project
      if (!proj) return
      const label = collection.name
      setSaveStatus('saving', label)
      window.reqstraApi
        .saveProject(proj)
        .then(() => {
          setSaveStatus('saved', label)
          if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
          savedTimerRef.current = setTimeout(() => setSaveStatus('idle', null), 2000)
        })
        .catch(console.error)
    },
    [endpoint, collection, updateEndpoint, setSaveStatus],
  )

  const scheduleEndpointSave = (
    m: HttpMethod,
    p: string,
    bt: HttpBodyType,
    hdrs: Record<string, string>,
    a: GraphQLAuth,
  ): void => {
    if (endpointTimerRef.current) clearTimeout(endpointTimerRef.current)
    endpointTimerRef.current = setTimeout(() => saveEndpointData(m, p, bt, hdrs, a), 800)
  }

  const autoSaveCase = useCallback(
    (b: string, qp: Record<string, string>, pp: Record<string, string>, bt: HttpBodyType): void => {
      if (!project || !endpoint || tab.type !== 'case') return
      const filePath = path.join(project.projectDir, endpoint.casesDir, tab.caseName)
      const label = tab.caseName.replace(/\.ya?ml$/, '')
      setSaveStatus('saving', label)
      window.reqstraApi
        .writeCase(filePath, serializeHttpCaseFile(b, qp, pp, bt))
        .then(() => {
          setSaveStatus('saved', label)
          if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
          savedTimerRef.current = setTimeout(() => setSaveStatus('idle', null), 2000)
        })
        .catch(console.error)
    },
    [project, endpoint, tab, setSaveStatus],
  )

  const handleMethodChange = (v: HttpMethod): void => {
    setMethod(v)
    scheduleEndpointSave(v, epPath, bodyType, headers, auth)
  }
  const handlePathChange = (v: string): void => {
    setEpPath(v)
    scheduleEndpointSave(method, v, bodyType, headers, auth)
  }
  const handleBodyTypeChange = (v: HttpBodyType): void => {
    setBodyType(v)
    scheduleEndpointSave(method, epPath, v, headers, auth)
  }
  const handleHeadersChange = (v: Record<string, string>): void => {
    setHeaders(v)
    scheduleEndpointSave(method, epPath, bodyType, v, auth)
  }
  const handleAuthChange = (v: GraphQLAuth): void => {
    setAuth(v)
    scheduleEndpointSave(method, epPath, bodyType, headers, v)
  }
  const handleBodyChange = (v: string): void => {
    setBody(v)
    autoSaveCase(v, queryParams, pathParams, bodyType)
  }
  const handleQueryParamsChange = (v: Record<string, string>): void => {
    setQueryParams(v)
    autoSaveCase(body, v, pathParams, bodyType)
  }
  const handlePathParamsChange = (v: Record<string, string>): void => {
    setPathParams(v)
    autoSaveCase(body, queryParams, v, bodyType)
  }

  const handleSend = async (): Promise<void> => {
    if (!project || !endpoint || !collection || !activeTarget) {
      setResponse({
        status: 'ERROR',
        body: '',
        httpStatus: 0,
        durationMs: 0,
        error: 'HTTP ターゲットが設定されていません',
      })
      return
    }

    const params: HttpRequestParams = {
      baseUrl: activeTarget.baseUrl,
      method,
      path: epPath,
      pathParams,
      headers,
      auth,
      bodyType,
      body,
      queryParams,
    }

    setIsLoading(true)
    try {
      const result = await window.reqstraApi.httpRequest(params)
      setResponse(result)

      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        protocol: 'http',
        collectionName: collection.name,
        endpointName: endpoint.name,
        caseName: tab.type === 'case' ? tab.caseName : '(scratch)',
        status: result.status,
        durationMs: result.durationMs,
        request: { method, path: epPath, body, queryParams, pathParams },
        response: result.body,
      }
      window.reqstraApi.writeLog(project.projectDir, logEntry).catch(console.error)
    } catch (e) {
      setResponse({
        status: 'ERROR',
        body: '',
        httpStatus: 0,
        durationMs: 0,
        error: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
        <span className="rounded bg-[#0e639c]/20 px-2 py-0.5 text-xs font-medium text-[#4fc1ff]">
          HTTP
        </span>
        <span className="flex-1 truncate text-xs text-[var(--color-text-secondary)]">
          {endpointLabel}
        </span>
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={isLoading}
          className="rounded bg-[#0e639c] px-4 py-1 text-xs text-white hover:bg-[#1177bb] disabled:opacity-50"
        >
          ▶ Send
        </button>
      </div>

      {/* 本体: 左右分割 */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanes
          defaultLeftWidth={480}
          minLeft={200}
          minRight={200}
          storageKey="pane-http-response-width"
        >
          <RequestEditor
            method={method}
            path={epPath}
            bodyType={bodyType}
            body={body}
            queryParams={queryParams}
            pathParams={pathParams}
            headers={headers}
            auth={auth}
            onMethodChange={handleMethodChange}
            onPathChange={handlePathChange}
            onBodyTypeChange={handleBodyTypeChange}
            onBodyChange={handleBodyChange}
            onQueryParamsChange={handleQueryParamsChange}
            onPathParamsChange={handlePathParamsChange}
            onHeadersChange={handleHeadersChange}
            onAuthChange={handleAuthChange}
          />
          <ResponseViewer response={response} isLoading={isLoading} />
        </ResizablePanes>
      </div>
    </div>
  )
}
```

**重要:** `parseHttpCaseFile` と `serializeHttpCaseFile` を Renderer から直接 import しているが、これは Main Process のファイルを参照している。Renderer から Node.js モジュール（yaml）を使うのはアーキテクチャ違反になる可能性がある。

確認: `src/main/http/client.ts` は `yaml` を使用しているが、`vite.config.ts` で `path-browserify` のように `yaml` に Renderer 側での alias があるか確認する。

```bash
cat /Users/mktkbys/Documents/workspace/reqstra-studio/electron.vite.config.ts
```

`yaml` パッケージはブラウザでも動作するため、Renderer からの直接 import は通常問題ない。しかし Main Process ファイルを直接 import するのは違反。

対応: `parseHttpCaseFile` と `serializeHttpCaseFile` を `src/shared/` に移動するか、Renderer 側でインライン実装する。

**修正方針:** Renderer での YAML 処理を `GraphQLPanel/index.tsx` と同様にインライン実装する（`import * as yaml from 'yaml'` は GraphQLPanel でも Renderer 直接 import されているので問題ない）。

`HttpPanel/index.tsx` の import を修正:

```ts
import * as yaml from 'yaml'
// parseHttpCaseFile, serializeHttpCaseFile の import を削除
```

`parseHttpCaseFile` と `serializeHttpCaseFile` をファイル内にインライン定義:

```ts
function parseHttpCaseFile(raw: string): {
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

function serializeHttpCaseFile(
  body: string,
  queryParams: Record<string, string>,
  pathParams: Record<string, string>,
  bodyType: HttpBodyType,
): string {
  const obj: Record<string, unknown> = {}
  if (bodyType === 'json' && body.trim()) obj.body = body
  if (bodyType === 'query' && Object.keys(queryParams).length > 0) obj.params = queryParams
  if (Object.keys(pathParams).length > 0) obj.pathParams = pathParams
  return yaml.stringify(obj)
}
```

上記修正を反映した `index.tsx` を保存する。

- [ ] **Step 2: 型チェック**

```bash
cd /Users/mktkbys/Documents/workspace/reqstra-studio && npx tsc --noEmit
```

- [ ] **Step 3: コミット**

```bash
git add src/renderer/src/components/MainPanel/HttpPanel/index.tsx
git commit -m "feat: HTTP メインパネルコンポーネントを実装する"
```

---

## Task 9: UI — MainPanel に HttpPanel を組み込む

**Files:**
- Modify: `src/renderer/src/components/MainPanel/index.tsx`

- [ ] **Step 1: `src/renderer/src/components/MainPanel/index.tsx` を更新**

```tsx
import type { JSX } from 'react'
import { useAppStore } from '../../store/appStore'
import { TabBar } from './TabBar'
import { GrpcPanel } from './GrpcPanel'
import { GraphQLPanel } from './GraphQLPanel'
import { HttpPanel } from './HttpPanel'

export function MainPanel(): JSX.Element {
  const openTabs = useAppStore((s) => s.openTabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const activeProtocol = useAppStore((s) => s.activeProtocol)

  const activeTab = openTabs.find((t) => t.id === activeTabId)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TabBar />
      <div className="flex-1 overflow-hidden">
        {!activeTab && (
          <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">
            <p className="text-sm">サイドバーからエンドポイントまたはケースを選択してください</p>
          </div>
        )}
        {activeTab && activeProtocol === 'grpc' && (
          <GrpcPanel key={activeTab.id} tab={activeTab} />
        )}
        {activeTab && activeProtocol === 'graphql' && (
          <GraphQLPanel key={activeTab.id} tab={activeTab} />
        )}
        {activeTab && activeProtocol === 'http' && (
          <HttpPanel key={activeTab.id} tab={activeTab} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 型チェック**

```bash
cd /Users/mktkbys/Documents/workspace/reqstra-studio && npx tsc --noEmit
```

- [ ] **Step 3: テストを実行して既存テストが通ることを確認**

```bash
cd /Users/mktkbys/Documents/workspace/reqstra-studio && npm run test
```

期待出力: 全テスト `PASS`

- [ ] **Step 4: コミット**

```bash
git add src/renderer/src/components/MainPanel/index.tsx
git commit -m "feat: MainPanel に HttpPanel を組み込む"
```

---

## 自己レビューメモ

### スペックカバレッジ確認

| スペック要件 | 対応タスク |
|---|---|
| HttpMethod / HttpBodyType / HttpEndpoint 型 | Task 1 |
| HttpRequestParams / HttpResponse / IpcApi 型 | Task 1 |
| buildUrl (path params + query params) | Task 2 |
| buildAuthHeader | Task 2 |
| parseHttpCaseFile | Task 2 |
| executeHttpRequest | Task 2 |
| IPC ハンドラー http:request | Task 3 |
| preload に httpRequest 公開 | Task 3 |
| HttpEndpointModal | Task 4 |
| CollectionTree HTTP 対応 | Task 5 |
| ResponseViewer (Body/Headers タブ) | Task 6 |
| RequestEditor (method/path/bodyType/pathParams/headers/auth) | Task 7 |
| HttpPanel/index.tsx (送信・自動保存・ログ) | Task 8 |
| MainPanel に HttpPanel 組み込み | Task 9 |

### 型一貫性

- `HttpMethod` / `HttpBodyType` / `HttpEndpoint` は Task 1 で定義 → Task 4, 7, 8 で使用: ✓
- `HttpRequestParams` / `HttpResponse` は Task 1 で定義 → Task 2, 3, 8 で使用: ✓
- `parseHttpCaseFile` / `serializeHttpCaseFile` は Task 2 (main) と Task 8 (renderer インライン) で重複実装 → アーキテクチャ上必要な重複: ✓
- `window.reqstraApi.httpRequest` は Task 3 で追加 → Task 8 で使用: ✓
