# Phase 2: GraphQL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GraphQLリクエスト実行（クエリ・変数・ヘッダー・認証）とスキーマイントロスペクション表示をサポートする GraphQL プロトコル実装を追加する。

**Architecture:** Main Process で `graphql-request` を使って HTTP POST 実行し、IPC 経由で Renderer に返す。Renderer 側ではクエリのシンタックス検証・Pretty フォーマット・レスポンス表示を担当。ケースファイルはYAML形式で `query / variables / auth / headers` を保持する。

**Tech Stack:** graphql, graphql-request, yaml（既存）, React 18, Monaco Editor（既存）, Zustand（既存）

---

## File Structure

```
src/main/graphql/
└── client.ts                    # parseGraphQLCaseFile, buildAuthHeader, executeGraphQLRequest, introspectSchema

src/main/ipc/
└── graphql.ts                   # registerGraphQLHandlers()

src/shared/types/
├── project.ts                   # GraphQLEndpoint追加, Collection.endpoints型変更, GraphQLTarget.url追加
└── ipc.ts                       # GraphQLAuth, GraphQLRequestParams, GraphQLResponse追加, IpcApi拡張

src/preload/index.ts             # graphqlRequest, graphqlIntrospect 追加

src/renderer/src/components/
├── shared/
│   └── ResizablePanes.tsx       # direction?: 'horizontal' | 'vertical' 追加
├── MainPanel/
│   └── GraphQLPanel/
│       ├── index.tsx            # メインパネル（状態・Send/Introspect処理）
│       ├── QueryEditor.tsx      # Query上段+Variables下段+[Headers][Auth]タブ
│       └── ResponseViewer.tsx   # GraphQLレスポンス表示
└── modals/
    └── GraphQLEndpointModal.tsx # GraphQLエンドポイント追加/編集モーダル

src/renderer/src/store/
└── projectStore.ts              # addEndpoint/updateEndpoint型を GrpcEndpoint | GraphQLEndpoint に変更

src/renderer/src/components/Sidebar/
└── CollectionTree.tsx           # graphql protocol対応（GraphQLEndpointModal使用）

src/renderer/src/components/MainPanel/
└── index.tsx                    # GraphQLPanel を追加

tests/main/graphql/
└── client.test.ts               # parseGraphQLCaseFile, buildAuthHeader のユニットテスト
```

---

## Task 1: パッケージインストールと型定義の更新

**Files:**
- Modify: `src/shared/types/project.ts`
- Modify: `src/shared/types/ipc.ts`

- [ ] **Step 1: graphql と graphql-request をインストールする**

```bash
cd /Users/mktkbys/Documents/workspace/reqstra-studio
npm install graphql graphql-request
```

Expected: `node_modules/graphql` と `node_modules/graphql-request` が追加される。

- [ ] **Step 2: `project.ts` に `GraphQLEndpoint` を追加し `Collection.endpoints` と `GraphQLTarget` を更新する**

`src/shared/types/project.ts` を以下に全置換する：

```typescript
export interface GrpcTarget {
  id: string
  name: string
  host: string
  secure: boolean
}

export interface GraphQLTarget {
  id: string
  name: string
  url: string  // "http://localhost:8080/graphql"（フルエンドポイントURL）
}

export interface HttpTarget {
  id: string
  name: string
  baseUrl: string
}

export interface EnvironmentProtocols {
  grpc?: GrpcTarget[]
  graphql?: GraphQLTarget[]
  http?: HttpTarget[]
}

export interface Environment {
  id: string
  name: string
  protocols: EnvironmentProtocols
}

export interface GrpcEndpoint {
  id: string
  name: string
  method: string   // "ServiceName/MethodName"
  casesDir: string // "requests/grpc/UserService/GetUser"
}

export interface GraphQLEndpoint {
  id: string
  name: string      // 操作名 e.g. "GetUser"
  casesDir: string  // "requests/graphql/GetUser"
}

export interface Collection {
  id: string
  protocol: 'grpc' | 'graphql' | 'http'
  name: string
  protocolTargetId: string
  endpoints: GrpcEndpoint[] | GraphQLEndpoint[]
}

export interface ReqstraProject {
  name: string
  projectDir: string
  environments: Environment[]
  collections: Collection[]
}
```

- [ ] **Step 3: `ipc.ts` に GraphQL 型を追加し `IpcApi` を拡張する**

`src/shared/types/ipc.ts` の末尾（`IpcApi` の直前）に追加し、`IpcApi` に2メソッドを追加する：

```typescript
import type { ReqstraProject } from './project'

export interface GrpcServiceInfo {
  name: string
  methods: string[]
}

export interface GrpcRequestParams {
  host: string
  secure: boolean
  method: string
  body: string
  metadata: Record<string, string>
}

export interface GrpcResponse {
  status: 'OK' | 'ERROR'
  body: unknown
  trailers: Record<string, string>
  durationMs: number
  error?: string
  grpcCode?: number
}

export type GraphQLAuthType = 'none' | 'bearer' | 'basic' | 'oauth2'

export interface GraphQLAuth {
  type: GraphQLAuthType
  token?: string     // bearer / oauth2
  username?: string  // basic
  password?: string  // basic
}

export interface GraphQLRequestParams {
  url: string
  query: string
  variables: string              // YAML文字列（Main Processでパース）
  headers: Record<string, string>
  auth: GraphQLAuth
}

export interface GraphQLResponse {
  status: 'OK' | 'ERROR'
  data: unknown
  errors: unknown[]
  httpStatus: number
  durationMs: number
  error?: string
}

export interface LogEntry {
  timestamp: string
  protocol: 'grpc' | 'graphql' | 'http'
  collectionName: string
  endpointName: string
  caseName: string
  status: string
  durationMs: number
  request: unknown
  response: unknown
}

export interface IpcApi {
  openProject: () => Promise<ReqstraProject | null>
  saveProject: (project: ReqstraProject) => Promise<void>
  readCase: (absolutePath: string) => Promise<string>
  writeCase: (absolutePath: string, content: string) => Promise<void>
  deleteCase: (absolutePath: string) => Promise<void>
  listCases: (absoluteCasesDir: string) => Promise<string[]>
  scanCaseDirs: (projectDir: string) => Promise<string[]>
  grpcReflect: (host: string, secure: boolean) => Promise<GrpcServiceInfo[]>
  grpcDescribeMethod: (host: string, secure: boolean, method: string) => Promise<string>
  grpcRequest: (params: GrpcRequestParams) => Promise<GrpcResponse>
  graphqlRequest: (params: GraphQLRequestParams) => Promise<GraphQLResponse>
  graphqlIntrospect: (url: string, headers: Record<string, string>, auth: GraphQLAuth) => Promise<string>
  writeLog: (projectDir: string, entry: LogEntry) => Promise<void>
  readLogs: (projectDir: string, date: string) => Promise<LogEntry[]>
}
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npm run test
```

Expected: 既存テストが全件 PASS（型定義のみの変更なのでテストは壊れない）

- [ ] **Step 5: コミットする**

```bash
git add src/shared/types/ package.json package-lock.json
git commit -m "feat: GraphQL型定義を追加しgraphql/graphql-requestをインストール"
```

---

## Task 2: Main Process — GraphQL クライアント（TDD）

**Files:**
- Create: `tests/main/graphql/client.test.ts`
- Create: `src/main/graphql/client.ts`

- [ ] **Step 1: テストを書く**

`tests/main/graphql/client.test.ts` を作成する：

```typescript
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
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npm run test -- --project main
```

Expected: FAIL — `Cannot find module '../../../src/main/graphql/client'`

- [ ] **Step 3: 実装する**

`src/main/graphql/client.ts` を作成する：

```typescript
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
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npm run test -- --project main
```

Expected: 新しい8テスト含め全件 PASS

- [ ] **Step 5: コミットする**

```bash
git add src/main/graphql/client.ts tests/main/graphql/client.test.ts
git commit -m "feat: GraphQLクライアント（parseGraphQLCaseFile, buildAuthHeader, executeGraphQLRequest）を実装"
```

---

## Task 3: Main Process — IPCハンドラー登録

**Files:**
- Create: `src/main/ipc/graphql.ts`
- Modify: `src/main/ipc/index.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: `graphql.ts` IPCハンドラーを作成する**

`src/main/ipc/graphql.ts` を作成する：

```typescript
import { ipcMain } from 'electron'
import { executeGraphQLRequest, introspectSchema } from '../graphql/client'
import type { GraphQLRequestParams, GraphQLAuth } from '../../shared/types/ipc'

export function registerGraphQLHandlers(): void {
  ipcMain.handle('graphql:request', async (_event, params: GraphQLRequestParams) => {
    return executeGraphQLRequest(params)
  })

  ipcMain.handle(
    'graphql:introspect',
    async (
      _event,
      url: string,
      headers: Record<string, string>,
      auth: GraphQLAuth,
    ) => {
      return introspectSchema(url, headers, auth)
    },
  )
}
```

- [ ] **Step 2: `registerAllHandlers` に GraphQL を追加する**

`src/main/ipc/index.ts` の末尾近くにある `registerGrpcHandlers()` 呼び出しの後に追加する。ファイル先頭の import にも追記する：

```typescript
import { ipcMain, dialog } from 'electron'
import * as path from 'path'
import { readProject, saveProject, listCases, readCase, writeCase, deleteCase } from './project'
import { writeLog, readLogs } from './log'
import { registerGrpcHandlers } from './grpc'
import { registerGraphQLHandlers } from './graphql'
import type { ReqstraProject } from '../../shared/types/project'
import type { LogEntry } from '../../shared/types/ipc'

export function registerAllHandlers(): void {
  // ... 既存の ipcMain.handle コードは変更しない ...

  registerGrpcHandlers()
  registerGraphQLHandlers()
}
```

**注意:** `registerAllHandlers` の本体（`ipcMain.handle(...)` の列挙）はそのままにして、末尾に `registerGraphQLHandlers()` の呼び出しだけを追加する。

- [ ] **Step 3: preload に `graphqlRequest` と `graphqlIntrospect` を追加する**

`src/preload/index.ts` の `api` オブジェクトに2行追加する：

```typescript
import { contextBridge, ipcRenderer } from 'electron'
import type { IpcApi } from '../shared/types/ipc'

const api: IpcApi = {
  openProject: () => ipcRenderer.invoke('project:open'),
  saveProject: (project) => ipcRenderer.invoke('project:save', project),
  listCases: (casesDir) => ipcRenderer.invoke('project:listCases', casesDir),
  readCase: (absolutePath) => ipcRenderer.invoke('project:readCase', absolutePath),
  writeCase: (absolutePath, content) =>
    ipcRenderer.invoke('project:writeCase', absolutePath, content),
  deleteCase: (absolutePath) => ipcRenderer.invoke('project:deleteCase', absolutePath),
  scanCaseDirs: (projectDir) => ipcRenderer.invoke('grpc:scanCaseDirs', projectDir),
  grpcReflect: (host, secure) => ipcRenderer.invoke('grpc:reflect', host, secure),
  grpcDescribeMethod: (host, secure, method) =>
    ipcRenderer.invoke('grpc:describeMethod', host, secure, method),
  grpcRequest: (params) => ipcRenderer.invoke('grpc:request', params),
  graphqlRequest: (params) => ipcRenderer.invoke('graphql:request', params),
  graphqlIntrospect: (url, headers, auth) =>
    ipcRenderer.invoke('graphql:introspect', url, headers, auth),
  writeLog: (projectDir, entry) => ipcRenderer.invoke('log:write', projectDir, entry),
  readLogs: (projectDir, date) => ipcRenderer.invoke('log:read', projectDir, date),
}

contextBridge.exposeInMainWorld('reqstraApi', api)
```

- [ ] **Step 4: ビルドエラーがないことを確認する**

```bash
npm run test
```

Expected: 全件 PASS（`graphql:request` ハンドラーはテスト不要、IPC 接続の型チェックのみ確認）

- [ ] **Step 5: コミットする**

```bash
git add src/main/ipc/graphql.ts src/main/ipc/index.ts src/preload/index.ts
git commit -m "feat: GraphQL IPCハンドラーを登録しpreloadに公開"
```

---

## Task 4: projectStore の型更新

**Files:**
- Modify: `src/renderer/src/store/projectStore.ts`

- [ ] **Step 1: `addEndpoint` / `updateEndpoint` の型を拡張する**

`src/renderer/src/store/projectStore.ts` の import に `GraphQLEndpoint` を追加し、2つのアクションの型シグネチャを変更する：

import 行を変更（`GrpcEndpoint` の隣に `GraphQLEndpoint` を追加）：

```typescript
import type {
  ReqstraProject,
  Collection,
  Environment,
  GrpcTarget,
  HttpTarget,
  GraphQLTarget,
  GrpcEndpoint,
  GraphQLEndpoint,
} from '../../../shared/types/project'
```

`ProjectState` インターフェース内の2行を変更する：

```typescript
  addEndpoint: (collectionId: string, endpoint: GrpcEndpoint | GraphQLEndpoint) => void
  updateEndpoint: (collectionId: string, endpoint: GrpcEndpoint | GraphQLEndpoint) => void
```

`create` 内の実装2箇所も同様に型を変更する（ロジック自体は変更なし）：

```typescript
  addEndpoint: (collectionId, endpoint) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          collections: state.project.collections.map((c) =>
            c.id === collectionId ? { ...c, endpoints: [...c.endpoints, endpoint] } : c,
          ),
        },
      }
    }),
  updateEndpoint: (collectionId, endpoint) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          collections: state.project.collections.map((c) =>
            c.id === collectionId
              ? { ...c, endpoints: c.endpoints.map((ep) => (ep.id === endpoint.id ? endpoint : ep)) }
              : c,
          ),
        },
      }
    }),
```

- [ ] **Step 2: テストが通ることを確認する**

```bash
npm run test
```

Expected: 全件 PASS

- [ ] **Step 3: コミットする**

```bash
git add src/renderer/src/store/projectStore.ts
git commit -m "feat: projectStoreのaddEndpoint/updateEndpointをGraphQLEndpointに対応"
```

---

## Task 5: ResizablePanes の縦方向対応

**Files:**
- Modify: `src/renderer/src/components/shared/ResizablePanes.tsx`

- [ ] **Step 1: `direction` prop を追加して縦方向ドラッグをサポートする**

`src/renderer/src/components/shared/ResizablePanes.tsx` を以下に全置換する：

```typescript
import { useState, useCallback, useEffect, useRef, type JSX } from 'react'

interface Props {
  defaultLeftWidth: number
  minLeft?: number
  minRight?: number
  storageKey?: string
  direction?: 'horizontal' | 'vertical'
  children: [React.ReactNode, React.ReactNode]
}

export function ResizablePanes({
  defaultLeftWidth,
  minLeft = 120,
  minRight = 200,
  storageKey,
  direction = 'horizontal',
  children,
}: Props): JSX.Element {
  const stored = storageKey
    ? Number(localStorage.getItem(storageKey)) || defaultLeftWidth
    : defaultLeftWidth
  const [firstSize, setFirstSize] = useState<number>(stored)
  const isDragging = useRef<boolean>(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const isHorizontal = direction === 'horizontal'

  const handleMouseDown = useCallback((e: React.MouseEvent): void => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
  }, [isHorizontal])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const offset = isHorizontal ? e.clientX - rect.left : e.clientY - rect.top
      const total = isHorizontal ? containerRef.current.clientWidth : containerRef.current.clientHeight
      const newSize = Math.max(minLeft, Math.min(offset, total - minRight - 4))
      setFirstSize(newSize)
      if (storageKey) localStorage.setItem(storageKey, String(newSize))
    }

    const handleMouseUp = (): void => {
      if (!isDragging.current) return
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [minLeft, minRight, storageKey, isHorizontal])

  const dividerStyle = isHorizontal
    ? { width: 4, cursor: 'col-resize', flexShrink: 0 }
    : { height: 4, cursor: 'row-resize', flexShrink: 0 }

  const firstStyle = isHorizontal
    ? { width: firstSize, minWidth: minLeft, flexShrink: 0 }
    : { height: firstSize, minHeight: minLeft, flexShrink: 0 }

  return (
    <div
      ref={containerRef}
      className={`${isHorizontal ? 'flex' : 'flex flex-col'} h-full overflow-hidden`}
    >
      <div style={firstStyle} className="flex flex-col overflow-hidden">
        {children[0]}
      </div>
      <div
        style={dividerStyle}
        className="bg-transparent transition-colors hover:bg-[var(--color-text-accent)] active:bg-[var(--color-text-accent)]"
        onMouseDown={handleMouseDown}
      />
      <div className={`${isHorizontal ? 'min-w-0' : 'min-h-0'} flex-1 flex flex-col overflow-hidden`}>
        {children[1]}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: テストが通ることを確認する**

```bash
npm run test
```

Expected: 全件 PASS（既存の横方向 `ResizablePanes` の動作は変わらない）

- [ ] **Step 3: コミットする**

```bash
git add src/renderer/src/components/shared/ResizablePanes.tsx
git commit -m "feat: ResizablePartsに縦方向（direction='vertical'）サポートを追加"
```

---

## Task 6: GraphQLEndpointModal

**Files:**
- Create: `src/renderer/src/components/modals/GraphQLEndpointModal.tsx`

- [ ] **Step 1: モーダルを作成する**

`src/renderer/src/components/modals/GraphQLEndpointModal.tsx` を作成する：

```typescript
import { useState, type JSX } from 'react'
import type { GraphQLEndpoint } from '../../../../shared/types/project'

interface Props {
  mode: 'add' | 'edit'
  initial?: GraphQLEndpoint
  onSubmit: (ep: GraphQLEndpoint) => void
  onClose: () => void
  isSubmitting?: boolean
}

export function GraphQLEndpointModal({
  mode,
  initial,
  onSubmit,
  onClose,
  isSubmitting,
}: Props): JSX.Element {
  const [name, setName] = useState<string>(initial?.name ?? '')

  const casesDir = name.trim() ? `requests/graphql/${name.trim()}` : ''
  const isValid = name.trim().length > 0

  const handleSubmit = (): void => {
    if (!isValid) return
    onSubmit({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      casesDir,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-80 rounded bg-[var(--color-bg-secondary)] p-4 shadow-xl">
        <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
          {mode === 'add' ? 'エンドポイントを追加' : 'エンドポイントを編集'}
        </h2>

        <div className="mb-3">
          <label htmlFor="gql-ep-name" className="mb-1 block text-xs text-[var(--color-text-secondary)]">
            操作名
          </label>
          <input
            id="gql-ep-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            placeholder="例: GetUser"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            className="w-full rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-accent)]"
          />
        </div>

        {casesDir && (
          <div className="mb-4">
            <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
              ケースディレクトリ（自動生成）
            </label>
            <p className="font-mono text-xs text-[var(--color-text-secondary)]">{casesDir}</p>
          </div>
        )}

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

- [ ] **Step 2: テストが通ることを確認する**

```bash
npm run test
```

Expected: 全件 PASS

- [ ] **Step 3: コミットする**

```bash
git add src/renderer/src/components/modals/GraphQLEndpointModal.tsx
git commit -m "feat: GraphQLEndpointModal（エンドポイント追加/編集モーダル）を実装"
```

---

## Task 7: CollectionTree の GraphQL 対応

**Files:**
- Modify: `src/renderer/src/components/Sidebar/CollectionTree.tsx`

- [ ] **Step 1: import に `GraphQLEndpoint` を追加し、`ModalState` と関数シグネチャを更新する**

ファイル先頭の import を変更する：

```typescript
import type { Collection, GrpcEndpoint, GrpcTarget, GraphQLEndpoint } from '../../../../shared/types/project'
import { CollectionModal } from '../modals/CollectionModal'
import { EndpointModal } from '../modals/EndpointModal'
import { GraphQLEndpointModal } from '../modals/GraphQLEndpointModal'
```

`ModalState` 型の `edit-endpoint` を変更する（`endpoint` の型を Union に拡張）：

```typescript
type ModalState =
  | { type: 'add-collection' }
  | { type: 'edit-collection'; collection: Collection }
  | { type: 'add-endpoint'; collectionId: string }
  | { type: 'edit-endpoint'; collectionId: string; endpoint: GrpcEndpoint | GraphQLEndpoint }
  | null
```

`Collection.endpoints` が `GrpcEndpoint[] | GraphQLEndpoint[]` の Union 型になるため、エンドポイントを引数に取る関数シグネチャをすべて `GrpcEndpoint | GraphQLEndpoint` に変更する（ロジックは変更なし — これらの関数は `ep.id` / `ep.name` / `ep.casesDir` のみを使用しており、両型に共通するフィールドのみ参照している）：

```typescript
const isEndpointVisible = (ep: GrpcEndpoint | GraphQLEndpoint): boolean =>
  activeProtocol !== 'grpc' || isReflected || activeCaseDirs.has(ep.casesDir)

const toggleEndpoint = async (ep: GrpcEndpoint | GraphQLEndpoint): Promise<void> => { ... }

const handleCaseClick = (_col: Collection, ep: GrpcEndpoint | GraphQLEndpoint, caseName: string): void => { ... }

const handleCaseDuplicate = (ep: GrpcEndpoint | GraphQLEndpoint, caseName: string): void => { ... }

const handleCaseDuplicateConfirm = async (ep: GrpcEndpoint | GraphQLEndpoint): Promise<void> => { ... }

const handleCaseDelete = async (ep: GrpcEndpoint | GraphQLEndpoint, caseName: string): Promise<void> => { ... }
```

- [ ] **Step 2: `handleEndpointSubmit` の型を更新する**

```typescript
  const handleEndpointSubmit = async (ep: GrpcEndpoint | GraphQLEndpoint): Promise<void> => {
    setIsSubmitting(true)
    try {
      if (modalState?.type === 'add-endpoint') {
        addEndpoint(modalState.collectionId, ep)
      } else if (modalState?.type === 'edit-endpoint') {
        updateEndpoint(modalState.collectionId, ep)
      }
      if (await persistProject()) setModalState(null)
    } finally {
      setIsSubmitting(false)
    }
  }
```

- [ ] **Step 3: モーダルレンダリングに GraphQLEndpointModal を追加する**

ファイル末尾のモーダルレンダリング部分（`EndpointModal` の add と edit）を以下に置換する：

```tsx
      {modalState?.type === 'add-endpoint' && activeProtocol === 'graphql' && (
        <GraphQLEndpointModal
          mode="add"
          isSubmitting={isSubmitting}
          onSubmit={handleEndpointSubmit}
          onClose={() => setModalState(null)}
        />
      )}
      {modalState?.type === 'add-endpoint' && activeProtocol !== 'graphql' && (
        <EndpointModal
          mode="add"
          protocol={activeProtocol}
          isSubmitting={isSubmitting}
          onSubmit={handleEndpointSubmit}
          onClose={() => setModalState(null)}
        />
      )}
      {modalState?.type === 'edit-endpoint' && activeProtocol === 'graphql' && (
        <GraphQLEndpointModal
          mode="edit"
          initial={modalState.endpoint as GraphQLEndpoint}
          isSubmitting={isSubmitting}
          onSubmit={handleEndpointSubmit}
          onClose={() => setModalState(null)}
        />
      )}
      {modalState?.type === 'edit-endpoint' && activeProtocol !== 'graphql' && (
        <EndpointModal
          mode="edit"
          protocol={activeProtocol}
          initial={modalState.endpoint as GrpcEndpoint}
          isSubmitting={isSubmitting}
          onSubmit={handleEndpointSubmit}
          onClose={() => setModalState(null)}
        />
      )}
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npm run test
```

Expected: 全件 PASS

- [ ] **Step 5: コミットする**

```bash
git add src/renderer/src/components/Sidebar/CollectionTree.tsx
git commit -m "feat: CollectionTreeにGraphQLEndpointModal対応を追加"
```

---

## Task 8: GraphQLPanel — ResponseViewer

**Files:**
- Create: `src/renderer/src/components/MainPanel/GraphQLPanel/ResponseViewer.tsx`

- [ ] **Step 1: ResponseViewer を作成する**

`src/renderer/src/components/MainPanel/GraphQLPanel/ResponseViewer.tsx` を作成する：

```typescript
import { type JSX } from 'react'
import { MonacoEditor } from '../../shared/MonacoEditor'
import type { GraphQLResponse } from '../../../../../shared/types/ipc'

interface Props {
  response: GraphQLResponse | null
  isLoading: boolean
}

export function ResponseViewer({ response, isLoading }: Props): JSX.Element {
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

  const bodyString = JSON.stringify(
    response.errors.length > 0 ? { data: response.data, errors: response.errors } : response.data,
    null,
    2,
  ) ?? ''

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-1">
        <span
          className={`text-xs font-medium ${
            response.status === 'OK' ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'
          }`}
        >
          ● {response.status}
          {response.httpStatus > 0 && (
            <span className="ml-2 text-[var(--color-text-secondary)]">HTTP {response.httpStatus}</span>
          )}
        </span>
        <span className="text-xs text-[var(--color-text-secondary)]">{response.durationMs}ms</span>
      </div>
      {response.error && (
        <div className="border-b border-[var(--color-border)] bg-[#2d1515] px-3 py-2 text-xs text-[var(--color-error)]">
          {response.error}
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <MonacoEditor value={bodyString} language="json" readOnly />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: テストが通ることを確認する**

```bash
npm run test
```

Expected: 全件 PASS

---

## Task 9: GraphQLPanel — QueryEditor

**Files:**
- Create: `src/renderer/src/components/MainPanel/GraphQLPanel/QueryEditor.tsx`

- [ ] **Step 1: QueryEditor を作成する**

`src/renderer/src/components/MainPanel/GraphQLPanel/QueryEditor.tsx` を作成する：

```typescript
import { useState, type JSX } from 'react'
import { parse, print } from 'graphql'
import { MonacoEditor } from '../../shared/MonacoEditor'
import { MetadataEditor } from '../GrpcPanel/MetadataEditor'
import { ResizablePanes } from '../../shared/ResizablePanes'
import type { GraphQLAuth } from '../../../../../shared/types/ipc'

type BottomTab = 'variables' | 'headers' | 'auth'

interface Props {
  query: string
  variablesYaml: string
  headers: Record<string, string>
  auth: GraphQLAuth
  queryError: string | null
  onQueryChange: (v: string) => void
  onVariablesChange: (v: string) => void
  onHeadersChange: (v: Record<string, string>) => void
  onAuthChange: (v: GraphQLAuth) => void
}

export function QueryEditor({
  query,
  variablesYaml,
  headers,
  auth,
  queryError,
  onQueryChange,
  onVariablesChange,
  onHeadersChange,
  onAuthChange,
}: Props): JSX.Element {
  const [bottomTab, setBottomTab] = useState<BottomTab>('variables')

  const handlePretty = (): void => {
    try {
      onQueryChange(print(parse(query)))
    } catch {
      // パースエラー時は何もしない
    }
  }

  return (
    <ResizablePanes
      direction="vertical"
      defaultLeftWidth={260}
      minLeft={80}
      minRight={120}
      storageKey="pane-gql-query-height"
    >
      {/* 上段: クエリエディタ */}
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-1">
          <span className="text-xs text-[var(--color-text-secondary)]">Query</span>
          <button
            type="button"
            onClick={handlePretty}
            disabled={!!queryError}
            title="クエリを整形"
            className="rounded bg-[#3c3c3c] px-2 py-0.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-40"
          >
            Pretty
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <MonacoEditor value={query} onChange={(v) => onQueryChange(v ?? '')} language="graphql" />
        </div>
        {queryError && (
          <p className="border-t border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-error)]">
            {queryError}
          </p>
        )}
      </div>

      {/* 下段: Variables + [Headers][Auth] タブ */}
      <div className="flex h-full flex-col">
        <div className="flex border-b border-[var(--color-border)] px-3 py-1 text-xs">
          {(['variables', 'headers', 'auth'] as BottomTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setBottomTab(tab)}
              className={`mr-3 capitalize ${
                bottomTab === tab
                  ? 'text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)]'
              }`}
            >
              {tab === 'variables' ? 'Variables' : tab === 'headers' ? 'Headers' : 'Auth'}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          {bottomTab === 'variables' && (
            <MonacoEditor
              value={variablesYaml}
              onChange={(v) => onVariablesChange(v ?? '')}
              language="yaml"
            />
          )}
          {bottomTab === 'headers' && (
            <MetadataEditor metadata={headers} onChange={onHeadersChange} />
          )}
          {bottomTab === 'auth' && (
            <AuthEditor auth={auth} onChange={onAuthChange} />
          )}
        </div>
      </div>
    </ResizablePanes>
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

- [ ] **Step 2: テストが通ることを確認する**

```bash
npm run test
```

Expected: 全件 PASS

---

## Task 10: GraphQLPanel — メインパネル

**Files:**
- Create: `src/renderer/src/components/MainPanel/GraphQLPanel/index.tsx`

- [ ] **Step 1: GraphQLPanel を作成する**

`src/renderer/src/components/MainPanel/GraphQLPanel/index.tsx` を作成する：

```typescript
import { useState, useEffect, useCallback, type JSX } from 'react'
import * as yaml from 'yaml'
import { parse } from 'graphql'
import { QueryEditor } from './QueryEditor'
import { ResponseViewer } from './ResponseViewer'
import { ResizablePanes } from '../../shared/ResizablePanes'
import { useAppStore, type Tab } from '../../../store/appStore'
import { useProjectStore } from '../../../store/projectStore'
import type {
  GraphQLResponse,
  GraphQLRequestParams,
  GraphQLAuth,
  LogEntry,
} from '../../../../../shared/types/ipc'
import type { GraphQLTarget, GraphQLEndpoint } from '../../../../../shared/types/project'
import * as path from 'path'

interface Props {
  tab: Tab
}

const DEFAULT_AUTH: GraphQLAuth = { type: 'none' }

function serializeCaseFile(
  query: string,
  variablesYaml: string,
  headers: Record<string, string>,
  auth: GraphQLAuth,
): string {
  const obj: Record<string, unknown> = { query }
  if (variablesYaml.trim()) {
    try {
      obj.variables = yaml.parse(variablesYaml) as unknown
    } catch {
      // 不正YAMLは保存しない
    }
  }
  if (auth.type !== 'none') obj.auth = auth
  if (Object.keys(headers).length > 0) obj.headers = headers
  return yaml.stringify(obj)
}

function getQueryError(query: string): string | null {
  if (!query.trim()) return null
  try {
    parse(query)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

export function GraphQLPanel({ tab }: Props): JSX.Element {
  const project = useProjectStore((s) => s.project)
  const setCasesForEndpoint = useProjectStore((s) => s.setCasesForEndpoint)
  const addActiveCasesDir = useProjectStore((s) => s.addActiveCasesDir)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const activeProtocolTargetId = useAppStore((s) => s.activeProtocolTargetId)
  const replaceTab = useAppStore((s) => s.replaceTab)

  const [query, setQuery] = useState<string>('')
  const [variablesYaml, setVariablesYaml] = useState<string>('')
  const [headers, setHeaders] = useState<Record<string, string>>({})
  const [auth, setAuth] = useState<GraphQLAuth>(DEFAULT_AUTH)
  const [response, setResponse] = useState<GraphQLResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [saveNameInput, setSaveNameInput] = useState<string>('')
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const queryError = getQueryError(query)

  const endpoint = project?.collections
    .flatMap((c) => c.endpoints)
    .find((ep) => ep.id === tab.endpointId) as GraphQLEndpoint | undefined

  const collection = project?.collections.find((c) =>
    c.endpoints.some((ep) => ep.id === tab.endpointId),
  )

  const activeEnv =
    project?.environments.find((e) => e.id === activeEnvironmentId) ?? project?.environments[0]
  const graphqlTargets = (activeEnv?.protocols?.graphql as GraphQLTarget[] | undefined) ?? []
  const activeTarget =
    graphqlTargets.find((t) => t.id === activeProtocolTargetId) ?? graphqlTargets[0]

  const endpointLabel = activeTarget?.url
    ? `${activeTarget.url}${endpoint ? ` / ${endpoint.name}` : ''}`
    : '(ターゲット未設定)'

  // ケースファイルを読み込んでフォームを初期化する
  useEffect(() => {
    if (!project || !endpoint || tab.type !== 'case') {
      setQuery('')
      setVariablesYaml('')
      setHeaders({})
      setAuth(DEFAULT_AUTH)
      return
    }
    const filePath = path.join(project.projectDir, endpoint.casesDir, tab.caseName)
    window.reqstraApi
      .readCase(filePath)
      .then((raw) => {
        try {
          const parsed = yaml.parse(raw) as Record<string, unknown>
          setQuery(typeof parsed.query === 'string' ? parsed.query : '')
          setVariablesYaml(
            parsed.variables !== undefined ? yaml.stringify(parsed.variables) : '',
          )
          const h =
            typeof parsed.headers === 'object' && parsed.headers !== null
              ? (parsed.headers as Record<string, string>)
              : {}
          setHeaders(h)
          const a =
            typeof parsed.auth === 'object' && parsed.auth !== null
              ? (parsed.auth as GraphQLAuth)
              : DEFAULT_AUTH
          setAuth(a)
        } catch {
          setQuery('')
          setVariablesYaml('')
          setHeaders({})
          setAuth(DEFAULT_AUTH)
        }
      })
      .catch(() => {
        setQuery('')
      })
  }, [tab.id, project, endpoint])

  const autoSave = useCallback(
    (q: string, vars: string, hdrs: Record<string, string>, a: GraphQLAuth): void => {
      if (!project || !endpoint || tab.type !== 'case') return
      const filePath = path.join(project.projectDir, endpoint.casesDir, tab.caseName)
      const content = serializeCaseFile(q, vars, hdrs, a)
      window.reqstraApi.writeCase(filePath, content).catch(console.error)
    },
    [project, endpoint, tab],
  )

  const handleQueryChange = (v: string): void => {
    setQuery(v)
    autoSave(v, variablesYaml, headers, auth)
  }
  const handleVariablesChange = (v: string): void => {
    setVariablesYaml(v)
    autoSave(query, v, headers, auth)
  }
  const handleHeadersChange = (v: Record<string, string>): void => {
    setHeaders(v)
    autoSave(query, variablesYaml, v, auth)
  }
  const handleAuthChange = (v: GraphQLAuth): void => {
    setAuth(v)
    autoSave(query, variablesYaml, headers, v)
  }

  const handleSave = async (): Promise<void> => {
    const rawName = saveNameInput.trim()
    if (!rawName || !project || !endpoint) return
    setSaveError(null)
    const caseName = rawName.endsWith('.yaml') ? rawName : `${rawName}.yaml`
    const filePath = path.join(project.projectDir, endpoint.casesDir, caseName)

    setIsSaving(true)
    try {
      await window.reqstraApi.writeCase(filePath, serializeCaseFile(query, variablesYaml, headers, auth))
      replaceTab(tab.id, {
        type: 'case',
        id: `${endpoint.id}::${caseName}`,
        label: `${endpoint.name} / ${rawName.replace(/\.ya?ml$/, '')}`,
        endpointId: endpoint.id,
        caseName,
      })
      const casesAbsDir = path.join(project.projectDir, endpoint.casesDir)
      const updatedCases = await window.reqstraApi.listCases(casesAbsDir)
      setCasesForEndpoint(endpoint.id, updatedCases)
      addActiveCasesDir(endpoint.casesDir)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsSaving(false)
    }
  }

  const handleSend = async (): Promise<void> => {
    if (!project || !endpoint || !collection || !activeTarget) {
      setResponse({
        status: 'ERROR',
        data: null,
        errors: [],
        httpStatus: 0,
        durationMs: 0,
        error: 'GraphQL ターゲットが設定されていません',
      })
      return
    }

    const params: GraphQLRequestParams = {
      url: activeTarget.url,
      query,
      variables: variablesYaml,
      headers,
      auth,
    }

    setIsLoading(true)
    let result: GraphQLResponse
    try {
      result = await window.reqstraApi.graphqlRequest(params)
    } finally {
      setIsLoading(false)
    }
    setResponse(result)

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      protocol: 'graphql',
      collectionName: collection.name,
      endpointName: endpoint.name,
      caseName: tab.type === 'case' ? tab.caseName : '(scratch)',
      status: result.status,
      durationMs: result.durationMs,
      request: query,
      response: result.data,
    }
    window.reqstraApi.writeLog(project.projectDir, logEntry).catch(console.error)
  }

  const handleIntrospect = async (): Promise<void> => {
    if (!activeTarget) return
    setIsLoading(true)
    try {
      const schemaJson = await window.reqstraApi.graphqlIntrospect(
        activeTarget.url,
        headers,
        auth,
      )
      setResponse({
        status: 'OK',
        data: JSON.parse(schemaJson) as unknown,
        errors: [],
        httpStatus: 200,
        durationMs: 0,
      })
    } catch (e) {
      setResponse({
        status: 'ERROR',
        data: null,
        errors: [],
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
        <span className="rounded bg-[#e535ab]/20 px-2 py-0.5 text-xs font-medium text-[#e535ab]">
          GraphQL
        </span>
        <span className="flex-1 truncate text-xs text-[var(--color-text-secondary)]">
          {endpointLabel}
        </span>

        {tab.type === 'scratch' && (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={saveNameInput}
              onChange={(e) => setSaveNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSave()
                if (e.key === 'Escape') setSaveNameInput('')
              }}
              placeholder="ケース名"
              className="w-32 rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-0.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-accent)]"
            />
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!saveNameInput.trim() || isSaving}
              className="rounded bg-[var(--color-bg-active)] px-2 py-0.5 text-xs text-white disabled:opacity-50"
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        )}
        {tab.type === 'scratch' && saveError && (
          <span className="text-xs text-[var(--color-error)]">{saveError}</span>
        )}

        <button
          type="button"
          onClick={() => void handleIntrospect()}
          disabled={isLoading || !activeTarget}
          className="rounded bg-[#3c3c3c] px-3 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
        >
          Introspect
        </button>
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={isLoading || !!queryError || !query.trim()}
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
          storageKey="pane-gql-response-width"
        >
          <QueryEditor
            query={query}
            variablesYaml={variablesYaml}
            headers={headers}
            auth={auth}
            queryError={queryError}
            onQueryChange={handleQueryChange}
            onVariablesChange={handleVariablesChange}
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

- [ ] **Step 2: テストが通ることを確認する**

```bash
npm run test
```

Expected: 全件 PASS

- [ ] **Step 3: コミットする**

```bash
git add src/renderer/src/components/MainPanel/GraphQLPanel/
git commit -m "feat: GraphQLPanel（QueryEditor, ResponseViewer, メインパネル）を実装"
```

---

## Task 11: MainPanel への接続と動作確認

**Files:**
- Modify: `src/renderer/src/components/MainPanel/index.tsx`

- [ ] **Step 1: `MainPanel` に `GraphQLPanel` を追加する**

`src/renderer/src/components/MainPanel/index.tsx` を以下に全置換する：

```typescript
import type { JSX } from 'react'
import { useAppStore } from '../../store/appStore'
import { TabBar } from './TabBar'
import { GrpcPanel } from './GrpcPanel'
import { GraphQLPanel } from './GraphQLPanel'

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
        {activeTab && activeProtocol !== 'grpc' && activeProtocol !== 'graphql' && (
          <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">
            <p className="text-sm">{activeProtocol.toUpperCase()} は次フェーズで実装予定</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 全テストが通ることを確認する**

```bash
npm run test
```

Expected: 全件 PASS

- [ ] **Step 3: アプリを起動して動作確認する**

```bash
npm run dev
```

確認項目（手動テスト）：
1. ActivityBarでGraphQLアイコンをクリックするとサイドバーが「GRAPHQL EXPLORER」に切り替わる
2. サイドバーの「＋」でコレクション追加、コレクション内の「＋」でエンドポイント追加できる
3. エンドポイントをクリックするとスクラッチタブが開き、Query/Variables/Headers/Authエディタが表示される
4. クエリを入力→シンタックスエラーがあると Send ボタンが無効化される
5. Pretty ボタンでクエリが整形される
6. GraphQL サーバーがあれば Send で結果が返る。なければエラーレスポンスが表示される
7. Introspect ボタンでスキーマ JSON がレスポンスに表示される
8. スクラッチタブでケース名を入力して保存→ケースタブに変わりサイドバーに表示される
9. ケースタブで編集すると自動保存される

- [ ] **Step 4: コミットする**

```bash
git add src/renderer/src/components/MainPanel/index.tsx
git commit -m "feat: MainPanelにGraphQLPanelを接続しPhase 2完了"
```

---

## 次のフェーズ

- **Phase 3**: HTTP実装
