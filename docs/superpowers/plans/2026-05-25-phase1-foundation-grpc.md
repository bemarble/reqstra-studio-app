# Reqstra Studio Phase 1: App Foundation + gRPC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Electron + Reactアプリの基盤を構築し、gRPCのサーバーリフレクション・リクエスト実行・実行ログ保存が動作する状態にする。

**Architecture:** Main ProcessでgRPC通信（@grpc/grpc-js）を担い、contextBridge経由でRenderer（React + Zustand）と型安全に連携。プロジェクト設定はreqstra-project.json、リクエストパラメータはエンドポイント/ケースごとのYAMLファイルで管理。

**Tech Stack:** electron-vite, React 18, TypeScript, @grpc/grpc-js, @grpc/proto-loader@^0.7, grpc-js-reflection-client, yaml, zustand, @monaco-editor/react, path-browserify, TailwindCSS, vitest

> **実装スコープ注意（Phase 1）:**
> - コレクション・エンドポイントの追加は `reqstra-project.json` を直接編集して行う（管理UIはPhase 2以降で追加）
> - gRPCリフレクションはSendボタン押下時に自動実行される（独立した「Reflect」ボタンUIはPhase 2以降）

---

## File Structure

```
reqstra-studio/
├── electron.vite.config.ts
├── vitest.config.ts
├── tailwind.config.js
├── src/
│   ├── shared/
│   │   └── types/
│   │       ├── project.ts       # プロジェクトデータ型定義
│   │       └── ipc.ts           # IPC API型定義・gRPC型定義
│   ├── main/
│   │   ├── index.ts             # Electronエントリーポイント
│   │   ├── ipc/
│   │   │   ├── index.ts         # IPCハンドラー登録
│   │   │   ├── project.ts       # プロジェクトファイルI/O
│   │   │   ├── grpc.ts          # gRPC IPC ハンドラー
│   │   │   └── log.ts           # 実行ログI/O
│   │   └── grpc/
│   │       ├── reflection.ts    # サーバーリフレクションクライアント
│   │       └── client.ts        # gRPCリクエスト実行
│   ├── preload/
│   │   └── index.ts             # contextBridge API定義
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── store/
│           │   ├── appStore.ts       # アクティブプロトコル・環境・タブ
│           │   └── projectStore.ts   # プロジェクトデータ
│           └── components/
│               ├── ActivityBar.tsx
│               ├── Sidebar/
│               │   ├── index.tsx
│               │   ├── EnvironmentSelector.tsx
│               │   ├── ProtocolTargetSelector.tsx
│               │   └── CollectionTree.tsx
│               ├── MainPanel/
│               │   ├── index.tsx
│               │   ├── TabBar.tsx
│               │   └── GrpcPanel/
│               │       ├── index.tsx
│               │       ├── RequestEditor.tsx
│               │       ├── MetadataEditor.tsx
│               │       └── ResponseViewer.tsx
│               └── shared/
│                   └── MonacoEditor.tsx
└── tests/
    ├── main/
    │   ├── ipc/project.test.ts
    │   ├── ipc/log.test.ts
    │   └── grpc/
    │       ├── reflection.test.ts
    │       └── client.test.ts
    └── renderer/
        └── store/
            └── appStore.test.ts
```

---

## Task 1: プロジェクトのスキャフォールディング

**Files:**
- Create: `package.json`, `tsconfig.json`, `electron.vite.config.ts`, `vitest.config.ts`, `tailwind.config.js`
- Create: `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/src/main.tsx`

- [ ] **Step 1: electron-vite でプロジェクトを初期化する**

```bash
cd /Users/mktkbys/Documents/workspace/reqstra-studio
npm create @quick-start/electron@latest . -- --template react-ts
```

既存ファイルの上書きを確認されたら `y` を選択。

- [ ] **Step 2: 必要な依存関係をインストールする**

```bash
npm install @grpc/grpc-js "@grpc/proto-loader@^0.7" grpc-js-reflection-client yaml zustand @monaco-editor/react path-browserify
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom tailwindcss autoprefixer @types/path-browserify
```

- [ ] **Step 3: electron.vite.config.ts で path を path-browserify にエイリアスする**

`electron.vite.config.ts` の `renderer` セクションに以下を追加する（Rendererプロセスはブラウザ環境なのでNode.jsの `path` モジュールが使えないため）：

```typescript
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        path: 'path-browserify', // RendererでimportするpathはNode非依存のpath-browserifyを使う
      },
    },
  },
})
```

- [ ] **Step 5: TailwindCSS を初期化する**

```bash
npx tailwindcss init -p
```

`tailwind.config.js` を以下に更新する：

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{html,tsx,ts}'],
  theme: { extend: {} },
  plugins: [],
}
```

`src/renderer/src/main.tsx` の先頭に追加：

```tsx
import './index.css'
```

`src/renderer/src/index.css` を作成：

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-bg-primary: #1e1e1e;
  --color-bg-secondary: #252526;
  --color-bg-tertiary: #2d2d30;
  --color-bg-active: #094771;
  --color-border: #333333;
  --color-text-primary: #cccccc;
  --color-text-secondary: #888888;
  --color-text-accent: #4fc1ff;
  --color-success: #3fb950;
  --color-error: #f85149;
}

body {
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  margin: 0;
  overflow: hidden;
}
```

- [ ] **Step 6: vitest を設定する**

`vitest.config.ts` を作成：

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'main',
          include: ['tests/main/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'renderer',
          include: ['tests/renderer/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['tests/setup.ts'],
        },
      },
    ],
  },
})
```

`tests/setup.ts` を作成：

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 7: アプリが起動することを確認する**

```bash
npm run dev
```

Electronウィンドウが開き、デフォルトのVite + Reactの画面が表示されることを確認。Ctrl+Cで終了。

- [ ] **Step 8: コミットする**

```bash
git add -A
git commit -m "feat: electron-viteでプロジェクト基盤を構築"
```

---

## Task 2: 共有型定義

**Files:**
- Create: `src/shared/types/project.ts`
- Create: `src/shared/types/ipc.ts`

- [ ] **Step 1: プロジェクトデータの型を定義する**

`src/shared/types/project.ts` を作成：

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
  host: string
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
  method: string // "ServiceName/MethodName" e.g. "UserService/GetUser"
  casesDir: string // "requests/grpc/UserService/GetUser"
}

export interface Collection {
  id: string
  protocol: 'grpc' | 'graphql' | 'http'
  name: string
  protocolTargetId: string
  endpoints: GrpcEndpoint[]
}

export interface ReqstraProject {
  name: string
  projectDir: string // プロジェクトフォルダの絶対パス（保存時に付与）
  environments: Environment[]
  collections: Collection[]
}
```

- [ ] **Step 2: IPC APIの型を定義する**

`src/shared/types/ipc.ts` を作成：

```typescript
import type { ReqstraProject } from './project'

export interface GrpcServiceInfo {
  name: string
  methods: string[]
}

export interface GrpcRequestParams {
  host: string
  secure: boolean
  method: string // "ServiceName/MethodName"
  body: string   // YAMLの生文字列
  metadata: Record<string, string>
}

export interface GrpcResponse {
  status: 'OK' | 'ERROR'
  body: unknown
  trailers: Record<string, string>
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

// contextBridgeで公開するAPI
export interface IpcApi {
  openProject: () => Promise<ReqstraProject | null>
  saveProject: (project: ReqstraProject) => Promise<void>
  readCase: (absolutePath: string) => Promise<string>
  writeCase: (absolutePath: string, content: string) => Promise<void>
  listCases: (absoluteCasesDir: string) => Promise<string[]>
  grpcReflect: (host: string, secure: boolean) => Promise<GrpcServiceInfo[]>
  grpcRequest: (params: GrpcRequestParams) => Promise<GrpcResponse>
  writeLog: (projectDir: string, entry: LogEntry) => Promise<void>
  readLogs: (projectDir: string, date: string) => Promise<LogEntry[]>
}
```

- [ ] **Step 3: コミットする**

```bash
git add src/shared/
git commit -m "feat: プロジェクト・IPC共有型定義を追加"
```

---

## Task 3: プロジェクトファイルI/O（Main Process）

**Files:**
- Create: `src/main/ipc/project.ts`
- Create: `tests/main/ipc/project.test.ts`

- [ ] **Step 1: テストを書く**

`tests/main/ipc/project.test.ts` を作成：

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import * as os from 'os'
import * as path from 'path'
import { readProject, saveProject, listCases, readCase, writeCase } from '../../../src/main/ipc/project'
import type { ReqstraProject } from '../../../src/shared/types/project'

const tmpDir = () => fs.mkdtemp(path.join(os.tmpdir(), 'reqstra-test-'))

describe('readProject', () => {
  it('存在するプロジェクトJSONを読み込む', async () => {
    const dir = await tmpDir()
    const project: ReqstraProject = {
      name: 'Test Project',
      projectDir: dir,
      environments: [],
      collections: [],
    }
    await fs.writeFile(
      path.join(dir, 'reqstra-project.json'),
      JSON.stringify(project, null, 2)
    )

    const result = await readProject(dir)
    expect(result.name).toBe('Test Project')
    expect(result.projectDir).toBe(dir)
  })
})

describe('saveProject', () => {
  it('プロジェクトをJSONに保存する', async () => {
    const dir = await tmpDir()
    const project: ReqstraProject = {
      name: 'Save Test',
      projectDir: dir,
      environments: [],
      collections: [],
    }

    await saveProject(project)

    const raw = await fs.readFile(path.join(dir, 'reqstra-project.json'), 'utf-8')
    const parsed = JSON.parse(raw)
    expect(parsed.name).toBe('Save Test')
  })
})

describe('listCases / readCase / writeCase', () => {
  it('casesディレクトリ内のYAMLファイルを一覧する', async () => {
    const dir = await tmpDir()
    const casesDir = path.join(dir, 'requests', 'grpc', 'UserService', 'GetUser')
    await fs.mkdir(casesDir, { recursive: true })
    await fs.writeFile(path.join(casesDir, 'UserA.yaml'), 'user_id: "alice"')
    await fs.writeFile(path.join(casesDir, 'UserB.yaml'), 'user_id: "bob"')

    const cases = await listCases(casesDir)
    expect(cases).toHaveLength(2)
    expect(cases).toContain('UserA.yaml')
    expect(cases).toContain('UserB.yaml')
  })

  it('YAMLファイルを読み書きする', async () => {
    const dir = await tmpDir()
    const filePath = path.join(dir, 'UserA.yaml')

    await writeCase(filePath, 'user_id: "alice"\nrole: "admin"')
    const content = await readCase(filePath)

    expect(content).toBe('user_id: "alice"\nrole: "admin"')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npm run test -- --project main
```

Expected: FAIL with "Cannot find module '../../../src/main/ipc/project'"

- [ ] **Step 3: 実装する**

`src/main/ipc/project.ts` を作成：

```typescript
import { promises as fs } from 'fs'
import * as path from 'path'
import type { ReqstraProject } from '../../shared/types/project'

export async function readProject(projectDir: string): Promise<ReqstraProject> {
  const filePath = path.join(projectDir, 'reqstra-project.json')
  const raw = await fs.readFile(filePath, 'utf-8')
  const data = JSON.parse(raw) as ReqstraProject
  data.projectDir = projectDir
  return data
}

export async function saveProject(project: ReqstraProject): Promise<void> {
  const { projectDir, ...data } = project
  const filePath = path.join(projectDir, 'reqstra-project.json')
  await fs.writeFile(filePath, JSON.stringify({ ...data, projectDir }, null, 2))
}

export async function listCases(casesDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(casesDir)
    return entries.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
  } catch {
    return []
  }
}

export async function readCase(absolutePath: string): Promise<string> {
  return fs.readFile(absolutePath, 'utf-8')
}

export async function writeCase(absolutePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(absolutePath), { recursive: true })
  await fs.writeFile(absolutePath, content, 'utf-8')
}
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npm run test -- --project main
```

Expected: PASS（4テスト）

- [ ] **Step 5: コミットする**

```bash
git add src/main/ipc/project.ts tests/main/ipc/project.test.ts
git commit -m "feat: プロジェクトファイルI/Oを実装"
```

---

## Task 4: 実行ログI/O（Main Process）

**Files:**
- Create: `src/main/ipc/log.ts`
- Create: `tests/main/ipc/log.test.ts`

- [ ] **Step 1: テストを書く**

`tests/main/ipc/log.test.ts` を作成：

```typescript
import { describe, it, expect } from 'vitest'
import { promises as fs } from 'fs'
import * as os from 'os'
import * as path from 'path'
import { writeLog, readLogs } from '../../../src/main/ipc/log'
import type { LogEntry } from '../../../src/shared/types/ipc'

const tmpDir = () => fs.mkdtemp(path.join(os.tmpdir(), 'reqstra-log-test-'))

const sampleEntry = (): LogEntry => ({
  timestamp: '2026-05-25T10:00:00.000Z',
  protocol: 'grpc',
  collectionName: 'UserService',
  endpointName: 'GetUser',
  caseName: 'UserA',
  status: 'OK',
  durationMs: 43,
  request: { user_id: 'alice' },
  response: { id: 'alice', name: 'Alice' },
})

describe('writeLog / readLogs', () => {
  it('ログをNDJSONで追記し読み込める', async () => {
    const dir = await tmpDir()
    const entry1 = sampleEntry()
    const entry2 = { ...sampleEntry(), caseName: 'UserB', durationMs: 55 }

    await writeLog(dir, entry1)
    await writeLog(dir, entry2)

    const logs = await readLogs(dir, '2026-05-25')
    expect(logs).toHaveLength(2)
    expect(logs[0].caseName).toBe('UserA')
    expect(logs[1].caseName).toBe('UserB')
  })

  it('存在しない日付のログは空配列を返す', async () => {
    const dir = await tmpDir()
    const logs = await readLogs(dir, '2026-01-01')
    expect(logs).toEqual([])
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npm run test -- --project main
```

Expected: FAIL

- [ ] **Step 3: 実装する**

`src/main/ipc/log.ts` を作成：

```typescript
import { promises as fs } from 'fs'
import * as path from 'path'
import type { LogEntry } from '../../shared/types/ipc'

function logFilePath(projectDir: string, date: string): string {
  return path.join(projectDir, 'logs', `${date}.ndjson`)
}

export async function writeLog(projectDir: string, entry: LogEntry): Promise<void> {
  const date = entry.timestamp.slice(0, 10) // "YYYY-MM-DD"
  const filePath = logFilePath(projectDir, date)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.appendFile(filePath, JSON.stringify(entry) + '\n', 'utf-8')
}

export async function readLogs(projectDir: string, date: string): Promise<LogEntry[]> {
  const filePath = logFilePath(projectDir, date)
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return raw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as LogEntry)
  } catch {
    return []
  }
}
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npm run test -- --project main
```

Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/main/ipc/log.ts tests/main/ipc/log.test.ts
git commit -m "feat: 実行ログI/Oを実装（NDJSON形式）"
```

---

## Task 5: gRPC サーバーリフレクション（Main Process）

**Files:**
- Create: `src/main/grpc/reflection.ts`
- Create: `tests/main/grpc/reflection.test.ts`

- [ ] **Step 1: テストを書く**

`tests/main/grpc/reflection.test.ts` を作成：

```typescript
import { describe, it, expect, vi } from 'vitest'
import { buildServiceList } from '../../../src/main/grpc/reflection'
import type { GrpcServiceInfo } from '../../../src/shared/types/ipc'

describe('buildServiceList', () => {
  it('サービス名とメソッド名のリストをフィルタリングして返す', () => {
    // サーバーリフレクション自体のサービスは除外する
    const rawServices = [
      'grpc.reflection.v1alpha.ServerReflection',
      'grpc.health.v1.Health',
      'UserService',
      'OrderService',
    ]

    const result = buildServiceList(rawServices)

    expect(result.map((s) => s.name)).toEqual(['UserService', 'OrderService'])
  })

  it('空のリストは空を返す', () => {
    expect(buildServiceList([])).toEqual([])
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npm run test -- --project main
```

Expected: FAIL

- [ ] **Step 3: 実装する**

`src/main/grpc/reflection.ts` を作成：

```typescript
import * as grpc from '@grpc/grpc-js'
import { GrpcReflection } from 'grpc-js-reflection-client'
import type { GrpcServiceInfo } from '../../shared/types/ipc'

// grpcの内部サービスは除外する
const INTERNAL_SERVICE_PREFIXES = ['grpc.reflection', 'grpc.health']

export function buildServiceList(rawServiceNames: string[]): GrpcServiceInfo[] {
  return rawServiceNames
    .filter((name) => !INTERNAL_SERVICE_PREFIXES.some((prefix) => name.startsWith(prefix)))
    .map((name) => ({ name, methods: [] }))
}

export async function reflectServices(
  host: string,
  secure: boolean
): Promise<GrpcServiceInfo[]> {
  const credentials = secure
    ? grpc.credentials.createSsl()
    : grpc.credentials.createInsecure()

  const client = new GrpcReflection(host, credentials)
  const rawServices = await client.listServices()
  const serviceNames = buildServiceList(rawServices)

  // 各サービスのメソッドをリフレクションで取得
  const results: GrpcServiceInfo[] = []
  for (const svc of serviceNames) {
    try {
      const descriptor = await client.getDescriptorBySymbol(svc.name)
      const methods = extractMethods(descriptor, svc.name)
      results.push({ name: svc.name, methods })
    } catch {
      results.push({ name: svc.name, methods: [] })
    }
  }

  return results
}

function extractMethods(descriptor: unknown, serviceName: string): string[] {
  try {
    // grpc-js-reflection-client が返す FileDescriptorProto から
    // 対象サービスのメソッド名を抽出する
    const desc = descriptor as {
      getServiceList: () => Array<{
        getName: () => string
        getMethodList: () => Array<{ getName: () => string }>
      }>
    }
    const serviceDesc = desc
      .getServiceList()
      .find((s) => s.getName() === serviceName || s.getName() === serviceName.split('.').pop())
    if (!serviceDesc) return []
    return serviceDesc.getMethodList().map((m) => m.getName())
  } catch {
    return []
  }
}
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npm run test -- --project main
```

Expected: PASS（`buildServiceList` のユニットテスト）

- [ ] **Step 5: コミットする**

```bash
git add src/main/grpc/reflection.ts tests/main/grpc/reflection.test.ts
git commit -m "feat: gRPCサーバーリフレクションクライアントを実装"
```

---

## Task 6: gRPC リクエスト実行（Main Process）

**Files:**
- Create: `src/main/grpc/client.ts`
- Create: `tests/main/grpc/client.test.ts`

- [ ] **Step 1: テストを書く**

`tests/main/grpc/client.test.ts` を作成：

```typescript
import { describe, it, expect } from 'vitest'
import { parseYamlBody } from '../../../src/main/grpc/client'

describe('parseYamlBody', () => {
  it('YAMLをJSオブジェクトにパースする', () => {
    const yaml = 'user_id: "alice"\ninclude_deleted: false'
    const result = parseYamlBody(yaml)
    expect(result).toEqual({ user_id: 'alice', include_deleted: false })
  })

  it('空文字は空オブジェクトを返す', () => {
    expect(parseYamlBody('')).toEqual({})
  })

  it('不正なYAMLは空オブジェクトを返す（クラッシュしない）', () => {
    expect(parseYamlBody('{')).toEqual({})
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npm run test -- --project main
```

Expected: FAIL

- [ ] **Step 3: 実装する**

`src/main/grpc/client.ts` を作成：

```typescript
import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import { GrpcReflection } from 'grpc-js-reflection-client'
import * as yaml from 'yaml'
import type { GrpcRequestParams, GrpcResponse } from '../../shared/types/ipc'

export function parseYamlBody(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {}
  try {
    const parsed = yaml.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

export async function executeGrpcRequest(
  params: GrpcRequestParams
): Promise<GrpcResponse> {
  const { host, secure, method, body, metadata } = params
  const [serviceName, methodName] = method.split('/')

  if (!serviceName || !methodName) {
    return {
      status: 'ERROR',
      body: null,
      trailers: {},
      durationMs: 0,
      error: `メソッド形式が不正です: "${method}" （"ServiceName/MethodName" 形式で指定してください）`,
    }
  }

  const credentials = secure
    ? grpc.credentials.createSsl()
    : grpc.credentials.createInsecure()

  const start = Date.now()

  try {
    const reflectionClient = new GrpcReflection(host, credentials)
    const descriptor = await reflectionClient.getDescriptorBySymbol(serviceName)

    // FileDescriptorProtoからpackageDefinitionを生成する
    const root = (descriptor as unknown as { toObject: () => unknown }).toObject
      ? descriptor
      : null

    if (!root) {
      throw new Error('サービスのディスクリプターを取得できませんでした')
    }

    // proto-loaderにディスクリプターを渡してパッケージ定義を構築する
    const packageDefinition = await buildPackageDefinition(descriptor, host, credentials)
    const grpcObject = grpc.loadPackageDefinition(packageDefinition)

    // サービスクライアントを解決する（パッケージ付きの場合: pkg.ServiceName）
    const ServiceClient = resolveService(grpcObject, serviceName)
    if (!ServiceClient) {
      throw new Error(`サービス "${serviceName}" が見つかりません`)
    }

    const client = new (ServiceClient as new (
      host: string,
      credentials: grpc.ChannelCredentials
    ) => grpc.Client)(host, credentials)

    const requestBody = parseYamlBody(body)
    const grpcMetadata = new grpc.Metadata()
    for (const [k, v] of Object.entries(metadata)) {
      grpcMetadata.add(k, v)
    }

    return await new Promise<GrpcResponse>((resolve) => {
      // @ts-expect-error: dynamic method call
      client[methodName](requestBody, grpcMetadata, (err, response, trailers) => {
        const durationMs = Date.now() - start
        if (err) {
          resolve({
            status: 'ERROR',
            body: null,
            trailers: {},
            durationMs,
            error: err.message,
          })
        } else {
          resolve({
            status: 'OK',
            body: response,
            trailers: trailers?.getMap() ?? {},
            durationMs,
          })
        }
      })
    })
  } catch (e) {
    return {
      status: 'ERROR',
      body: null,
      trailers: {},
      durationMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

async function buildPackageDefinition(
  descriptor: unknown,
  host: string,
  credentials: grpc.ChannelCredentials
): Promise<protoLoader.PackageDefinition> {
  // grpc-js-reflection-client が返す FileDescriptorProto を
  // バイナリシリアライズして proto-loader に渡す
  const serialized = (descriptor as { serializeBinary: () => Uint8Array }).serializeBinary()
  const buffer = Buffer.from(serialized)
  // @ts-expect-error: loadFileDescriptorSetFromBuffer は @grpc/proto-loader の内部API
  return protoLoader.loadFileDescriptorSetFromBuffer(buffer, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  })
}

function resolveService(
  grpcObject: grpc.GrpcObject,
  serviceName: string
): grpc.ServiceClientConstructor | null {
  // "UserService" または "pkg.UserService" 形式に対応
  const parts = serviceName.split('.')
  let current: grpc.GrpcObject | grpc.ServiceClientConstructor = grpcObject
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return null
    current = (current as grpc.GrpcObject)[part] as
      | grpc.GrpcObject
      | grpc.ServiceClientConstructor
  }
  if (typeof current === 'function') {
    return current as grpc.ServiceClientConstructor
  }
  return null
}
```

**Note:** `protoLoader.loadFileDescriptorSetFromBuffer` は `@grpc/proto-loader` v0.7以降で利用可能。型定義が不足している場合は `@ts-expect-error` コメントを付けて使用する。もしAPIが存在しない場合は、protoをtmpファイルに書き出してからloadSyncを使う代替手段に切り替える。

- [ ] **Step 4: テストが通ることを確認する**

```bash
npm run test -- --project main
```

Expected: PASS（parseYamlBodyのテスト3件）

- [ ] **Step 5: コミットする**

```bash
git add src/main/grpc/client.ts tests/main/grpc/client.test.ts
git commit -m "feat: gRPCリクエスト実行クライアントを実装"
```

---

## Task 7: IPC ブリッジ（Main Process + Preload）

**Files:**
- Create: `src/main/ipc/grpc.ts`
- Create: `src/main/ipc/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: gRPC IPCハンドラーを作成する**

`src/main/ipc/grpc.ts` を作成：

```typescript
import { ipcMain, dialog } from 'electron'
import { reflectServices } from '../grpc/reflection'
import { executeGrpcRequest } from '../grpc/client'

export function registerGrpcHandlers(): void {
  ipcMain.handle('grpc:reflect', async (_event, host: string, secure: boolean) => {
    return reflectServices(host, secure)
  })

  ipcMain.handle('grpc:request', async (_event, params) => {
    return executeGrpcRequest(params)
  })
}
```

- [ ] **Step 2: プロジェクト IPCハンドラーを作成する**

`src/main/ipc/index.ts` を作成：

```typescript
import { ipcMain, dialog, app } from 'electron'
import * as path from 'path'
import { readProject, saveProject, listCases, readCase, writeCase } from './project'
import { writeLog, readLogs } from './log'
import { registerGrpcHandlers } from './grpc'

export function registerAllHandlers(): void {
  // プロジェクトを開く（フォルダ選択ダイアログ）
  ipcMain.handle('project:open', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'プロジェクトフォルダを選択',
    })
    if (result.canceled || !result.filePaths[0]) return null

    const projectDir = result.filePaths[0]
    try {
      return await readProject(projectDir)
    } catch {
      // reqstra-project.json が存在しない場合は新規作成
      const newProject = {
        name: path.basename(projectDir),
        projectDir,
        environments: [],
        collections: [],
      }
      await saveProject(newProject)
      return newProject
    }
  })

  ipcMain.handle('project:save', async (_event, project) => {
    await saveProject(project)
  })

  ipcMain.handle('project:listCases', async (_event, casesDir: string) => {
    return listCases(casesDir)
  })

  ipcMain.handle('project:readCase', async (_event, absolutePath: string) => {
    return readCase(absolutePath)
  })

  ipcMain.handle('project:writeCase', async (_event, absolutePath: string, content: string) => {
    await writeCase(absolutePath, content)
  })

  ipcMain.handle('log:write', async (_event, projectDir: string, entry) => {
    await writeLog(projectDir, entry)
  })

  ipcMain.handle('log:read', async (_event, projectDir: string, date: string) => {
    return readLogs(projectDir, date)
  })

  registerGrpcHandlers()
}
```

- [ ] **Step 3: Main Processのエントリーポイントでハンドラーを登録する**

`src/main/index.ts` の `app.whenReady()` ブロックを更新する：

```typescript
import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAllHandlers } from './ipc'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset', // macOSのトラフィックライトを維持
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.reqstra.studio')
  registerAllHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 4: Preload スクリプトでcontextBridgeを定義する**

`src/preload/index.ts` を更新する：

```typescript
import { contextBridge, ipcRenderer } from 'electron'
import type { IpcApi } from '../shared/types/ipc'

const api: IpcApi = {
  openProject: () => ipcRenderer.invoke('project:open'),
  saveProject: (project) => ipcRenderer.invoke('project:save', project),
  listCases: (casesDir) => ipcRenderer.invoke('project:listCases', casesDir),
  readCase: (absolutePath) => ipcRenderer.invoke('project:readCase', absolutePath),
  writeCase: (absolutePath, content) => ipcRenderer.invoke('project:writeCase', absolutePath, content),
  grpcReflect: (host, secure) => ipcRenderer.invoke('grpc:reflect', host, secure),
  grpcRequest: (params) => ipcRenderer.invoke('grpc:request', params),
  writeLog: (projectDir, entry) => ipcRenderer.invoke('log:write', projectDir, entry),
  readLogs: (projectDir, date) => ipcRenderer.invoke('log:read', projectDir, date),
}

contextBridge.exposeInMainWorld('reqstraApi', api)
```

`src/renderer/src/env.d.ts` に型定義を追加する（なければ作成）：

```typescript
/// <reference types="vite/client" />
import type { IpcApi } from '../../shared/types/ipc'

declare global {
  interface Window {
    reqstraApi: IpcApi
  }
}
```

- [ ] **Step 5: アプリが起動することを確認する**

```bash
npm run dev
```

コンソールにエラーが出ないことを確認してCtrl+Cで終了。

- [ ] **Step 6: コミットする**

```bash
git add src/main/ipc/ src/preload/ src/main/index.ts src/renderer/src/env.d.ts
git commit -m "feat: IPCブリッジ（contextBridge）を実装"
```

---

## Task 8: Zustand ストア

**Files:**
- Create: `src/renderer/src/store/appStore.ts`
- Create: `src/renderer/src/store/projectStore.ts`
- Create: `tests/renderer/store/appStore.test.ts`

- [ ] **Step 1: テストを書く**

`tests/renderer/store/appStore.test.ts` を作成：

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAppStore } from '../../../src/renderer/src/store/appStore'

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      activeProtocol: 'grpc',
      activeEnvironmentId: null,
      activeProtocolTargetId: null,
      openTabs: [],
      activeTabId: null,
    })
  })

  it('プロトコルを切り替える', () => {
    const { result } = renderHook(() => useAppStore())
    act(() => result.current.setActiveProtocol('http'))
    expect(result.current.activeProtocol).toBe('http')
  })

  it('タブを開く', () => {
    const { result } = renderHook(() => useAppStore())
    act(() => result.current.openTab({ id: 'tab-1', label: 'GetUser', endpointId: 'ep-1', caseName: 'UserA' }))
    expect(result.current.openTabs).toHaveLength(1)
    expect(result.current.activeTabId).toBe('tab-1')
  })

  it('同じタブを二重に開かない', () => {
    const { result } = renderHook(() => useAppStore())
    const tab = { id: 'tab-1', label: 'GetUser', endpointId: 'ep-1', caseName: 'UserA' }
    act(() => result.current.openTab(tab))
    act(() => result.current.openTab(tab))
    expect(result.current.openTabs).toHaveLength(1)
  })

  it('タブを閉じる', () => {
    const { result } = renderHook(() => useAppStore())
    act(() => result.current.openTab({ id: 'tab-1', label: 'GetUser', endpointId: 'ep-1', caseName: 'UserA' }))
    act(() => result.current.closeTab('tab-1'))
    expect(result.current.openTabs).toHaveLength(0)
    expect(result.current.activeTabId).toBeNull()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npm run test -- --project renderer
```

Expected: FAIL

- [ ] **Step 3: appStore を実装する**

`src/renderer/src/store/appStore.ts` を作成：

```typescript
import { create } from 'zustand'

export type Protocol = 'grpc' | 'graphql' | 'http'

export interface Tab {
  id: string
  label: string
  endpointId: string
  caseName: string
}

interface AppState {
  activeProtocol: Protocol
  activeEnvironmentId: string | null
  activeProtocolTargetId: string | null
  openTabs: Tab[]
  activeTabId: string | null
  setActiveProtocol: (protocol: Protocol) => void
  setActiveEnvironmentId: (id: string) => void
  setActiveProtocolTargetId: (id: string) => void
  openTab: (tab: Tab) => void
  closeTab: (id: string) => void
  setActiveTabId: (id: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeProtocol: 'grpc',
  activeEnvironmentId: null,
  activeProtocolTargetId: null,
  openTabs: [],
  activeTabId: null,
  setActiveProtocol: (protocol) => set({ activeProtocol: protocol, openTabs: [], activeTabId: null }),
  setActiveEnvironmentId: (id) => set({ activeEnvironmentId: id }),
  setActiveProtocolTargetId: (id) => set({ activeProtocolTargetId: id }),
  openTab: (tab) =>
    set((state) => {
      if (state.openTabs.find((t) => t.id === tab.id)) {
        return { activeTabId: tab.id }
      }
      return { openTabs: [...state.openTabs, tab], activeTabId: tab.id }
    }),
  closeTab: (id) =>
    set((state) => {
      const tabs = state.openTabs.filter((t) => t.id !== id)
      const activeTabId =
        state.activeTabId === id ? (tabs[tabs.length - 1]?.id ?? null) : state.activeTabId
      return { openTabs: tabs, activeTabId }
    }),
  setActiveTabId: (id) => set({ activeTabId: id }),
}))
```

- [ ] **Step 4: projectStore を実装する**

`src/renderer/src/store/projectStore.ts` を作成：

```typescript
import { create } from 'zustand'
import type { ReqstraProject, Collection, Environment } from '../../../shared/types/project'

interface ProjectState {
  project: ReqstraProject | null
  setProject: (project: ReqstraProject) => void
  updateCollection: (collection: Collection) => void
  addCollection: (collection: Collection) => void
  updateEnvironment: (env: Environment) => void
  addEnvironment: (env: Environment) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  project: null,
  setProject: (project) => set({ project }),
  updateCollection: (collection) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          collections: state.project.collections.map((c) =>
            c.id === collection.id ? collection : c
          ),
        },
      }
    }),
  addCollection: (collection) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          collections: [...state.project.collections, collection],
        },
      }
    }),
  updateEnvironment: (env) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          environments: state.project.environments.map((e) =>
            e.id === env.id ? env : e
          ),
        },
      }
    }),
  addEnvironment: (env) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          environments: [...state.project.environments, env],
        },
      }
    }),
}))
```

- [ ] **Step 5: テストが通ることを確認する**

```bash
npm run test -- --project renderer
```

Expected: PASS

- [ ] **Step 6: コミットする**

```bash
git add src/renderer/src/store/ tests/renderer/
git commit -m "feat: Zustandストア（appStore, projectStore）を実装"
```

---

## Task 9: UIシェル（ActivityBar + Sidebar + MainPanel）

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Create: `src/renderer/src/components/ActivityBar.tsx`
- Create: `src/renderer/src/components/Sidebar/index.tsx`
- Create: `src/renderer/src/components/Sidebar/EnvironmentSelector.tsx`
- Create: `src/renderer/src/components/Sidebar/ProtocolTargetSelector.tsx`
- Create: `src/renderer/src/components/Sidebar/CollectionTree.tsx`
- Create: `src/renderer/src/components/MainPanel/index.tsx`
- Create: `src/renderer/src/components/MainPanel/TabBar.tsx`

- [ ] **Step 1: App.tsx を更新する**

`src/renderer/src/App.tsx` を更新する：

```tsx
import { ActivityBar } from './components/ActivityBar'
import { Sidebar } from './components/Sidebar'
import { MainPanel } from './components/MainPanel'
import { useProjectStore } from './store/projectStore'
import { useAppStore } from './store/appStore'

export default function App(): JSX.Element {
  const project = useProjectStore((s) => s.project)
  const setProject = useProjectStore((s) => s.setProject)

  const handleOpenProject = async (): Promise<void> => {
    const result = await window.reqstraApi.openProject()
    if (result) setProject(result)
  }

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-[var(--color-text-accent)]">Reqstra Studio</h1>
          <p className="mb-6 text-[var(--color-text-secondary)]">API通信クライアント</p>
          <button
            onClick={handleOpenProject}
            className="rounded bg-[#0e639c] px-6 py-2 text-white hover:bg-[#1177bb]"
          >
            プロジェクトを開く
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg-primary)]">
      <ActivityBar />
      <Sidebar />
      <MainPanel />
    </div>
  )
}
```

- [ ] **Step 2: ActivityBar を実装する**

`src/renderer/src/components/ActivityBar.tsx` を作成：

```tsx
import { useAppStore, type Protocol } from '../store/appStore'

const PROTOCOLS: { id: Protocol; label: string; icon: string }[] = [
  { id: 'grpc', label: 'gRPC', icon: '⚡' },
  { id: 'graphql', label: 'GraphQL', icon: '◈' },
  { id: 'http', label: 'HTTP', icon: '🌐' },
]

export function ActivityBar(): JSX.Element {
  const activeProtocol = useAppStore((s) => s.activeProtocol)
  const setActiveProtocol = useAppStore((s) => s.setActiveProtocol)

  return (
    <div className="flex w-12 flex-col items-center border-r border-[var(--color-border)] bg-[#333333] py-2">
      {PROTOCOLS.map((p) => (
        <button
          key={p.id}
          title={p.label}
          onClick={() => setActiveProtocol(p.id)}
          className={`mb-1 flex h-10 w-10 items-center justify-center rounded text-lg transition-colors ${
            activeProtocol === p.id
              ? 'text-white'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
          style={activeProtocol === p.id ? { borderLeft: '2px solid #4fc1ff' } : {}}
        >
          {p.icon}
        </button>
      ))}
      <div className="flex-1" />
      <button className="mb-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]" title="設定">
        ⚙
      </button>
    </div>
  )
}
```

- [ ] **Step 3: EnvironmentSelector を実装する**

`src/renderer/src/components/Sidebar/EnvironmentSelector.tsx` を作成：

```tsx
import { useProjectStore } from '../../store/projectStore'
import { useAppStore } from '../../store/appStore'

export function EnvironmentSelector(): JSX.Element {
  const environments = useProjectStore((s) => s.project?.environments ?? [])
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const setActiveEnvironmentId = useAppStore((s) => s.setActiveEnvironmentId)

  const active = environments.find((e) => e.id === activeEnvironmentId) ?? environments[0]

  return (
    <div className="border-b border-[var(--color-border)] px-2 py-1">
      <select
        value={active?.id ?? ''}
        onChange={(e) => setActiveEnvironmentId(e.target.value)}
        className="w-full rounded bg-[#3c3c3c] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none"
      >
        {environments.map((env) => (
          <option key={env.id} value={env.id}>
            🌍 {env.name}
          </option>
        ))}
        {environments.length === 0 && <option value="">環境未設定</option>}
      </select>
    </div>
  )
}
```

- [ ] **Step 4: ProtocolTargetSelector を実装する**

`src/renderer/src/components/Sidebar/ProtocolTargetSelector.tsx` を作成：

```tsx
import { useProjectStore } from '../../store/projectStore'
import { useAppStore, type Protocol } from '../../store/appStore'

export function ProtocolTargetSelector(): JSX.Element {
  const project = useProjectStore((s) => s.project)
  const activeProtocol = useAppStore((s) => s.activeProtocol) as Protocol
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const activeProtocolTargetId = useAppStore((s) => s.activeProtocolTargetId)
  const setActiveProtocolTargetId = useAppStore((s) => s.setActiveProtocolTargetId)

  const env =
    project?.environments.find((e) => e.id === activeEnvironmentId) ??
    project?.environments[0]

  const targets = (env?.protocols?.[activeProtocol] as Array<{ id: string; name: string }> | undefined) ?? []
  const active = targets.find((t) => t.id === activeProtocolTargetId) ?? targets[0]

  return (
    <div className="border-b border-[var(--color-border)] px-2 py-1">
      <select
        value={active?.id ?? ''}
        onChange={(e) => setActiveProtocolTargetId(e.target.value)}
        className="w-full rounded bg-[#3c3c3c] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none"
      >
        {targets.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
        {targets.length === 0 && <option value="">ターゲット未設定</option>}
      </select>
    </div>
  )
}
```

- [ ] **Step 5: CollectionTree を実装する**

`src/renderer/src/components/Sidebar/CollectionTree.tsx` を作成：

```tsx
import { useState } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useAppStore } from '../../store/appStore'
import type { Collection, GrpcEndpoint } from '../../../../shared/types/project'
import * as path from 'path'

export function CollectionTree(): JSX.Element {
  const project = useProjectStore((s) => s.project)
  const activeProtocol = useAppStore((s) => s.activeProtocol)
  const openTab = useAppStore((s) => s.openTab)
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set())
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<string>>(new Set())
  const [casesByEndpoint, setCasesByEndpoint] = useState<Record<string, string[]>>({})

  const collections = (project?.collections ?? []).filter(
    (c) => c.protocol === activeProtocol
  )

  const toggleCollection = (id: string): void => {
    setExpandedCollections((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleEndpoint = async (ep: GrpcEndpoint): Promise<void> => {
    if (!project) return
    const casesAbsDir = path.join(project.projectDir, ep.casesDir)

    if (!expandedEndpoints.has(ep.id)) {
      const cases = await window.reqstraApi.listCases(casesAbsDir)
      setCasesByEndpoint((prev) => ({ ...prev, [ep.id]: cases }))
    }

    setExpandedEndpoints((prev) => {
      const next = new Set(prev)
      next.has(ep.id) ? next.delete(ep.id) : next.add(ep.id)
      return next
    })
  }

  const handleCaseClick = (col: Collection, ep: GrpcEndpoint, caseName: string): void => {
    openTab({
      id: `${ep.id}::${caseName}`,
      label: `${ep.name} / ${caseName.replace(/\.ya?ml$/, '')}`,
      endpointId: ep.id,
      caseName,
    })
  }

  return (
    <div className="flex-1 overflow-y-auto py-1 text-xs">
      {collections.length === 0 && (
        <p className="px-3 text-[var(--color-text-secondary)]">コレクションなし</p>
      )}
      {collections.map((col) => (
        <div key={col.id}>
          <button
            className="flex w-full items-center px-2 py-0.5 text-left text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
            onClick={() => toggleCollection(col.id)}
          >
            <span className="mr-1">{expandedCollections.has(col.id) ? '▾' : '▸'}</span>
            <span className="font-medium">{col.name}</span>
          </button>
          {expandedCollections.has(col.id) &&
            col.endpoints.map((ep) => (
              <div key={ep.id}>
                <button
                  className="flex w-full items-center py-0.5 pl-5 pr-2 text-left text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
                  onClick={() => toggleEndpoint(ep)}
                >
                  <span className="mr-1">{expandedEndpoints.has(ep.id) ? '▾' : '▸'}</span>
                  {ep.name}
                </button>
                {expandedEndpoints.has(ep.id) &&
                  (casesByEndpoint[ep.id] ?? []).map((caseName) => (
                    <button
                      key={caseName}
                      className="block w-full py-0.5 pl-10 pr-2 text-left text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-active)] hover:text-white"
                      onClick={() => handleCaseClick(col, ep, caseName)}
                    >
                      {caseName.replace(/\.ya?ml$/, '')}
                    </button>
                  ))}
              </div>
            ))}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Sidebar を組み合わせる**

`src/renderer/src/components/Sidebar/index.tsx` を作成：

```tsx
import { useAppStore } from '../../store/appStore'
import { EnvironmentSelector } from './EnvironmentSelector'
import { ProtocolTargetSelector } from './ProtocolTargetSelector'
import { CollectionTree } from './CollectionTree'

const PROTOCOL_LABELS = { grpc: 'GRPC EXPLORER', graphql: 'GRAPHQL EXPLORER', http: 'HTTP EXPLORER' }

export function Sidebar(): JSX.Element {
  const activeProtocol = useAppStore((s) => s.activeProtocol)

  return (
    <div className="flex w-52 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 py-1">
        <span className="text-xs text-[var(--color-text-secondary)]">
          {PROTOCOL_LABELS[activeProtocol]}
        </span>
      </div>
      <EnvironmentSelector />
      <ProtocolTargetSelector />
      <CollectionTree />
    </div>
  )
}
```

- [ ] **Step 7: TabBar を実装する**

`src/renderer/src/components/MainPanel/TabBar.tsx` を作成：

```tsx
import { useAppStore } from '../../store/appStore'

export function TabBar(): JSX.Element {
  const openTabs = useAppStore((s) => s.openTabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const setActiveTabId = useAppStore((s) => s.setActiveTabId)
  const closeTab = useAppStore((s) => s.closeTab)

  return (
    <div className="flex border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
      {openTabs.map((tab) => (
        <div
          key={tab.id}
          className={`flex cursor-pointer items-center gap-2 border-r border-[var(--color-border)] px-3 py-1 text-xs ${
            activeTabId === tab.id
              ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
          }`}
          onClick={() => setActiveTabId(tab.id)}
        >
          <span>{tab.label}</span>
          <button
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            onClick={(e) => {
              e.stopPropagation()
              closeTab(tab.id)
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 8: MainPanel のスケルトンを実装する**

`src/renderer/src/components/MainPanel/index.tsx` を作成：

```tsx
import { useAppStore } from '../../store/appStore'
import { TabBar } from './TabBar'

export function MainPanel(): JSX.Element {
  const openTabs = useAppStore((s) => s.openTabs)
  const activeTabId = useAppStore((s) => s.activeTabId)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TabBar />
      <div className="flex-1 overflow-hidden">
        {!activeTabId && (
          <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">
            <p className="text-sm">サイドバーからケースを選択してください</p>
          </div>
        )}
        {/* Task 10でGrpcPanelを接続する */}
      </div>
    </div>
  )
}
```

- [ ] **Step 9: アプリが起動しUIが表示されることを確認する**

```bash
npm run dev
```

「プロジェクトを開く」ボタンが表示され、プロジェクトフォルダを選択するとVS Code風の3ペインUIが表示されることを確認する。

- [ ] **Step 10: コミットする**

```bash
git add src/renderer/src/components/ src/renderer/src/App.tsx
git commit -m "feat: VS Code風UIシェルを実装（ActivityBar, Sidebar, MainPanel）"
```

---

## Task 10: Monaco Editor + GrpcPanel

**Files:**
- Create: `src/renderer/src/components/shared/MonacoEditor.tsx`
- Create: `src/renderer/src/components/MainPanel/GrpcPanel/index.tsx`
- Create: `src/renderer/src/components/MainPanel/GrpcPanel/RequestEditor.tsx`
- Create: `src/renderer/src/components/MainPanel/GrpcPanel/MetadataEditor.tsx`
- Create: `src/renderer/src/components/MainPanel/GrpcPanel/ResponseViewer.tsx`
- Modify: `src/renderer/src/components/MainPanel/index.tsx`

- [ ] **Step 1: Monaco Editor コンポーネントを実装する**

`src/renderer/src/components/shared/MonacoEditor.tsx` を作成：

```tsx
import Editor, { type OnChange } from '@monaco-editor/react'

interface Props {
  value: string
  onChange?: OnChange
  language?: string
  readOnly?: boolean
  height?: string
}

export function MonacoEditor({
  value,
  onChange,
  language = 'yaml',
  readOnly = false,
  height = '100%',
}: Props): JSX.Element {
  return (
    <Editor
      height={height}
      language={language}
      value={value}
      onChange={onChange}
      theme="vs-dark"
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        automaticLayout: true,
        padding: { top: 8 },
      }}
    />
  )
}
```

- [ ] **Step 2: MetadataEditor を実装する**

`src/renderer/src/components/MainPanel/GrpcPanel/MetadataEditor.tsx` を作成：

```tsx
import { useState } from 'react'

interface Props {
  metadata: Record<string, string>
  onChange: (metadata: Record<string, string>) => void
}

export function MetadataEditor({ metadata, onChange }: Props): JSX.Element {
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')

  const handleAdd = (): void => {
    if (!newKey.trim()) return
    onChange({ ...metadata, [newKey.trim()]: newValue })
    setNewKey('')
    setNewValue('')
  }

  const handleRemove = (key: string): void => {
    const next = { ...metadata }
    delete next[key]
    onChange(next)
  }

  return (
    <div className="p-2 text-xs">
      <div className="mb-2 space-y-1">
        {Object.entries(metadata).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="flex-1 text-[var(--color-text-accent)]">{k}</span>
            <span className="flex-1 text-[var(--color-text-primary)]">{v}</span>
            <button
              onClick={() => handleRemove(k)}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-error)]"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          placeholder="Key"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          className="flex-1 rounded bg-[#3c3c3c] px-2 py-1 text-[var(--color-text-primary)] outline-none"
        />
        <input
          placeholder="Value"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          className="flex-1 rounded bg-[#3c3c3c] px-2 py-1 text-[var(--color-text-primary)] outline-none"
        />
        <button
          onClick={handleAdd}
          className="rounded bg-[#0e639c] px-3 py-1 text-white hover:bg-[#1177bb]"
        >
          追加
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: ResponseViewer を実装する**

`src/renderer/src/components/MainPanel/GrpcPanel/ResponseViewer.tsx` を作成：

```tsx
import { useState } from 'react'
import { MonacoEditor } from '../../shared/MonacoEditor'
import type { GrpcResponse } from '../../../../../shared/types/ipc'

interface Props {
  response: GrpcResponse | null
  isLoading: boolean
}

type Tab = 'body' | 'trailers'

export function ResponseViewer({ response, isLoading }: Props): JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('body')

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">
        <span className="animate-pulse">送信中...</span>
      </div>
    )
  }

  if (!response) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)] text-xs">
        レスポンスなし
      </div>
    )
  }

  const bodyString = JSON.stringify(response.body, null, 2) ?? ''

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-1">
        <span
          className={`text-xs font-medium ${
            response.status === 'OK' ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'
          }`}
        >
          ● {response.status}
        </span>
        <span className="text-xs text-[var(--color-text-secondary)]">{response.durationMs}ms</span>
      </div>
      {response.status === 'ERROR' && (
        <div className="border-b border-[var(--color-border)] bg-[#2d1515] px-3 py-2 text-xs text-[var(--color-error)]">
          {response.error}
        </div>
      )}
      <div className="flex gap-2 border-b border-[var(--color-border)] px-3 py-1 text-xs">
        {(['body', 'trailers'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={activeTab === tab ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}
          >
            {tab === 'body' ? 'Body' : 'Trailers'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {activeTab === 'body' && (
          <MonacoEditor value={bodyString} language="json" readOnly />
        )}
        {activeTab === 'trailers' && (
          <div className="p-2 text-xs">
            {Object.entries(response.trailers).map(([k, v]) => (
              <div key={k} className="flex gap-4">
                <span className="text-[var(--color-text-accent)]">{k}</span>
                <span className="text-[var(--color-text-primary)]">{v}</span>
              </div>
            ))}
            {Object.keys(response.trailers).length === 0 && (
              <span className="text-[var(--color-text-secondary)]">なし</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: RequestEditor を実装する**

`src/renderer/src/components/MainPanel/GrpcPanel/RequestEditor.tsx` を作成：

```tsx
import { useState, useEffect } from 'react'
import { MonacoEditor } from '../../shared/MonacoEditor'
import { MetadataEditor } from './MetadataEditor'
import { useProjectStore } from '../../../store/projectStore'
import type { Tab } from '../../../store/appStore'
import * as path from 'path'

type TabName = 'request' | 'metadata'

interface Props {
  tab: Tab
  onBodyChange: (body: string) => void
  onMetadataChange: (metadata: Record<string, string>) => void
  body: string
  metadata: Record<string, string>
}

export function RequestEditor({ tab, onBodyChange, onMetadataChange, body, metadata }: Props): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabName>('request')

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-2 border-b border-[var(--color-border)] px-3 py-1 text-xs">
        {(['request', 'metadata'] as TabName[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={activeTab === t ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}
          >
            {t === 'request' ? 'Request' : 'Metadata'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {activeTab === 'request' && (
          <MonacoEditor value={body} onChange={(v) => onBodyChange(v ?? '')} language="yaml" />
        )}
        {activeTab === 'metadata' && (
          <MetadataEditor metadata={metadata} onChange={onMetadataChange} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: GrpcPanel を実装する**

`src/renderer/src/components/MainPanel/GrpcPanel/index.tsx` を作成：

```tsx
import { useState, useEffect, useCallback } from 'react'
import { RequestEditor } from './RequestEditor'
import { ResponseViewer } from './ResponseViewer'
import { useAppStore, type Tab } from '../../../store/appStore'
import { useProjectStore } from '../../../store/projectStore'
import type { GrpcResponse, GrpcRequestParams, LogEntry } from '../../../../../shared/types/ipc'
import type { Collection, GrpcEndpoint } from '../../../../../shared/types/project'
import * as path from 'path'

interface Props {
  tab: Tab
}

export function GrpcPanel({ tab }: Props): JSX.Element {
  const project = useProjectStore((s) => s.project)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const activeProtocolTargetId = useAppStore((s) => s.activeProtocolTargetId)

  const [body, setBody] = useState('')
  const [metadata, setMetadata] = useState<Record<string, string>>({})
  const [response, setResponse] = useState<GrpcResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // エンドポイントとコレクションを解決する
  const endpoint = project?.collections
    .flatMap((c) => c.endpoints)
    .find((ep) => ep.id === tab.endpointId) as GrpcEndpoint | undefined

  const collection = project?.collections.find((c) =>
    c.endpoints.some((ep) => ep.id === tab.endpointId)
  ) as Collection | undefined

  // ケースファイルを読み込む
  useEffect(() => {
    if (!project || !endpoint) return
    const filePath = path.join(project.projectDir, endpoint.casesDir, tab.caseName)
    window.reqstraApi.readCase(filePath).then(setBody).catch(() => setBody(''))
  }, [tab.id, project, endpoint])

  // 保存（編集のたびに自動保存）
  const handleBodyChange = useCallback(
    (newBody: string) => {
      setBody(newBody)
      if (!project || !endpoint) return
      const filePath = path.join(project.projectDir, endpoint.casesDir, tab.caseName)
      window.reqstraApi.writeCase(filePath, newBody).catch(console.error)
    },
    [project, endpoint, tab.caseName]
  )

  const handleSend = async (): Promise<void> => {
    if (!project || !endpoint || !collection) return

    const env = project.environments.find((e) => e.id === activeEnvironmentId) ?? project.environments[0]
    const grpcTargets = env?.protocols?.grpc ?? []
    const target = grpcTargets.find((t) => t.id === activeProtocolTargetId) ?? grpcTargets[0]

    if (!target) {
      setResponse({ status: 'ERROR', body: null, trailers: {}, durationMs: 0, error: 'gRPCターゲットが設定されていません' })
      return
    }

    const params: GrpcRequestParams = {
      host: target.host,
      secure: target.secure,
      method: endpoint.method,
      body,
      metadata,
    }

    setIsLoading(true)
    const result = await window.reqstraApi.grpcRequest(params)
    setIsLoading(false)
    setResponse(result)

    // ログを記録する
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      protocol: 'grpc',
      collectionName: collection.name,
      endpointName: endpoint.name,
      caseName: tab.caseName,
      status: result.status,
      durationMs: result.durationMs,
      request: params.body,
      response: result.body,
    }
    window.reqstraApi.writeLog(project.projectDir, logEntry).catch(console.error)
  }

  return (
    <div className="flex h-full flex-col">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
        <span className="rounded bg-[#0e639c] px-2 py-0.5 text-xs font-medium text-white">gRPC</span>
        <span className="flex-1 truncate text-xs text-[var(--color-text-secondary)]">
          {endpoint?.method ?? tab.label}
        </span>
        <button
          onClick={handleSend}
          disabled={isLoading}
          className="rounded bg-[#0e639c] px-4 py-1 text-xs text-white hover:bg-[#1177bb] disabled:opacity-50"
        >
          ▶ Send
        </button>
      </div>

      {/* リクエスト / レスポンスを左右に分割 */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden border-r border-[var(--color-border)]">
          <RequestEditor
            tab={tab}
            body={body}
            metadata={metadata}
            onBodyChange={handleBodyChange}
            onMetadataChange={setMetadata}
          />
        </div>
        <div className="w-80 overflow-hidden">
          <ResponseViewer response={response} isLoading={isLoading} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: MainPanel でGrpcPanelを接続する**

`src/renderer/src/components/MainPanel/index.tsx` を更新する：

```tsx
import { useAppStore } from '../../store/appStore'
import { TabBar } from './TabBar'
import { GrpcPanel } from './GrpcPanel'

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
            <p className="text-sm">サイドバーからケースを選択してください</p>
          </div>
        )}
        {activeTab && activeProtocol === 'grpc' && (
          <GrpcPanel key={activeTab.id} tab={activeTab} />
        )}
        {activeTab && activeProtocol !== 'grpc' && (
          <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">
            <p className="text-sm">{activeProtocol.toUpperCase()} は次フェーズで実装予定</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: 動作確認をする**

```bash
npm run dev
```

以下を確認する：
1. プロジェクトフォルダを開く
2. gRPCコレクション・エンドポイントがツリーに表示される（プロジェクトJSONに設定済みのもの）
3. ケースをクリックするとタブが開き、YAMLエディタが表示される
4. Sendボタンを押すとgRPCリクエストが実行され、レスポンスが表示される

手動テスト用のプロジェクトJSON（手元にgRPCサーバーがない場合はreflectionのエラーレスポンスを確認する）：

```json
{
  "name": "Test Project",
  "projectDir": "/path/to/test-project",
  "environments": [
    {
      "id": "dev",
      "name": "Development",
      "protocols": {
        "grpc": [
          { "id": "grpc-a", "name": "Local", "host": "localhost:50051", "secure": false }
        ]
      }
    }
  ],
  "collections": [
    {
      "id": "col-1",
      "protocol": "grpc",
      "name": "UserService",
      "protocolTargetId": "grpc-a",
      "endpoints": [
        {
          "id": "ep-1",
          "name": "GetUser",
          "method": "UserService/GetUser",
          "casesDir": "requests/grpc/UserService/GetUser"
        }
      ]
    }
  ]
}
```

- [ ] **Step 8: コミットする**

```bash
git add src/renderer/src/components/
git commit -m "feat: MonacoEditor + GrpcPanel（リクエスト/レスポンスUI）を実装"
```

---

## Task 11: ビルドと配布準備

**Files:**
- Modify: `electron.vite.config.ts`
- Modify: `package.json`

- [ ] **Step 1: electron-builderの設定を確認する**

`package.json` の `build` セクションが以下のようになっていることを確認し、なければ追加する：

```json
{
  "build": {
    "appId": "com.reqstra.studio",
    "productName": "Reqstra Studio",
    "mac": {
      "category": "public.app-category.developer-tools",
      "target": [{ "target": "dmg", "arch": ["arm64", "x64"] }]
    },
    "dmg": {
      "title": "Reqstra Studio"
    },
    "files": ["out/**/*"],
    "directories": {
      "buildResources": "build"
    }
  }
}
```

- [ ] **Step 2: ビルドが成功することを確認する**

```bash
npm run build
```

Expected: `out/` フォルダに成果物が生成される。

- [ ] **Step 3: .gitignore を更新する**

```bash
echo ".superpowers/" >> .gitignore
echo "out/" >> .gitignore
echo "dist/" >> .gitignore
```

- [ ] **Step 4: 全テストが通ることを確認する**

```bash
npm run test
```

Expected: main / renderer 両プロジェクトのテスト全件 PASS。

- [ ] **Step 5: 最終コミットをする**

```bash
git add .gitignore package.json electron.vite.config.ts
git commit -m "feat: Phase 1完了 - gRPC対応APIクライアントの基盤を構築"
```

---

## 次のフェーズ

- **Phase 2**: GraphQL実装 (`docs/superpowers/plans/2026-05-25-phase2-graphql.md`)
- **Phase 3**: HTTP実装 (`docs/superpowers/plans/2026-05-25-phase3-http.md`)
