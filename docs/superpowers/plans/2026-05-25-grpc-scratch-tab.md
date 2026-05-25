# gRPC スクラッチタブ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** RPC エンドポイントをクリックするだけで proto スキーマから JSON テンプレを生成して表示し、ケースファイルなしで gRPC リクエストを送信できるスクラッチモードを追加する。

**Architecture:** `getProtobufJsRoot()` で protobufjs の Root を取得し、`service.methods[methodName].resolvedRequestType.fields` を再帰的に辿って JSON テンプレを生成する。Renderer は `type: 'scratch' | 'case'` の union 型で Tab を区別し、スクラッチタブはマウント時に IPC 経由でテンプレを取得してそのまま編集可能にする。Save ボタンでケースファイルに書き込み、Tab を case 型に変換する。

**Tech Stack:** `grpc-js-reflection-client` (GrpcReflection, Descriptor.getProtobufJsRoot), `protobufjs` (Root, Type, Field), `@grpc/grpc-js`, Zustand, Monaco Editor, Vitest

---

## ファイル構成

| 操作 | ファイル | 変更内容 |
|---|---|---|
| 新規 | `src/main/grpc/describe.ts` | `describeMethod` 関数 |
| 新規 | `tests/main/grpc/describe.test.ts` | describe.ts のユニットテスト |
| 変更 | `src/shared/types/ipc.ts` | `grpcDescribeMethod` を IpcApi に追加 |
| 変更 | `src/main/ipc/grpc.ts` | `grpc:describeMethod` ハンドラーを登録 |
| 変更 | `src/preload/index.ts` | contextBridge に `grpcDescribeMethod` を追加 |
| 変更 | `src/renderer/src/store/appStore.ts` | Tab 型を union に変更、`replaceTab` を追加 |
| 変更 | `tests/renderer/store/appStore.test.ts` | 既存テストを `type: 'case'` に移行、新テストを追加 |
| 変更 | `src/renderer/src/components/Sidebar/CollectionTree.tsx` | エンドポイントクリック時にスクラッチタブを開く |
| 変更 | `src/renderer/src/components/MainPanel/GrpcPanel/index.tsx` | スクラッチタブの初期化・Save ボタン |
| 変更 | `src/renderer/src/components/MainPanel/GrpcPanel/RequestEditor.tsx` | `language` prop を追加 |
| 変更 | `src/renderer/src/components/MainPanel/index.tsx` | プレースホルダーテキストを更新 |

---

### Task 1: `describeMethod` のテストと実装

**Files:**
- Create: `tests/main/grpc/describe.test.ts`
- Create: `src/main/grpc/describe.ts`

- [ ] **Step 1: テストを書く**

```typescript
// tests/main/grpc/describe.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { describeMethod } from '../../../src/main/grpc/describe'

const { mockGetDescriptorBySymbol } = vi.hoisted(() => ({
  mockGetDescriptorBySymbol: vi.fn(),
}))

vi.mock('@grpc/grpc-js', () => ({
  credentials: {
    createInsecure: vi.fn(() => ({})),
    createSsl: vi.fn(() => ({})),
  },
}))

vi.mock('grpc-js-reflection-client', () => ({
  GrpcReflection: vi.fn(function () {
    return { getDescriptorBySymbol: mockGetDescriptorBySymbol }
  }),
}))

afterEach(() => {
  vi.restoreAllMocks()
})

function makeDescriptor(fields: Record<string, { type: string; rule?: string; resolvedType?: unknown }>) {
  const mockMethod = {
    resolvedRequestType: { fields },
  }
  const mockService = { methods: { GetUser: mockMethod } }
  const mockRoot = {
    resolveAll: vi.fn(),
    lookupService: vi.fn(() => mockService),
  }
  return { getProtobufJsRoot: vi.fn(() => mockRoot) }
}

describe('describeMethod', () => {
  it('string と int32 フィールドから JSON テンプレを生成する', async () => {
    mockGetDescriptorBySymbol.mockResolvedValue(
      makeDescriptor({
        user_id: { type: 'string' },
        age: { type: 'int32' },
      }),
    )

    const result = await describeMethod('localhost:50051', false, 'UserService/GetUser')

    expect(JSON.parse(result)).toEqual({ user_id: '', age: 0 })
  })

  it('repeated フィールドは [] になる', async () => {
    mockGetDescriptorBySymbol.mockResolvedValue(
      makeDescriptor({
        tags: { type: 'string', rule: 'repeated' },
      }),
    )

    const result = await describeMethod('localhost:50051', false, 'UserService/GetUser')

    expect(JSON.parse(result)).toEqual({ tags: [] })
  })

  it('ネストされたメッセージを再帰的に展開する', async () => {
    mockGetDescriptorBySymbol.mockResolvedValue(
      makeDescriptor({
        profile: {
          type: 'Profile',
          resolvedType: {
            fields: {
              name: { type: 'string' },
              age: { type: 'int32' },
            },
          },
        },
      }),
    )

    const result = await describeMethod('localhost:50051', false, 'UserService/GetUser')

    expect(JSON.parse(result)).toEqual({ profile: { name: '', age: 0 } })
  })

  it('enum フィールドは 0 になる', async () => {
    mockGetDescriptorBySymbol.mockResolvedValue(
      makeDescriptor({
        status: { type: 'Status', resolvedType: { values: { UNKNOWN: 0, ACTIVE: 1 } } },
      }),
    )

    const result = await describeMethod('localhost:50051', false, 'UserService/GetUser')

    expect(JSON.parse(result)).toEqual({ status: 0 })
  })

  it('メソッドが見つからない場合は空文字列を返す', async () => {
    const mockRoot = {
      resolveAll: vi.fn(),
      lookupService: vi.fn(() => ({ methods: {} })),
    }
    mockGetDescriptorBySymbol.mockResolvedValue({ getProtobufJsRoot: vi.fn(() => mockRoot) })

    const result = await describeMethod('localhost:50051', false, 'UserService/NotFound')

    expect(result).toBe('')
  })

  it('エラー発生時は空文字列を返す', async () => {
    mockGetDescriptorBySymbol.mockRejectedValue(new Error('接続失敗'))

    const result = await describeMethod('localhost:50051', false, 'UserService/GetUser')

    expect(result).toBe('')
  })

  it('bool フィールドは false になる', async () => {
    mockGetDescriptorBySymbol.mockResolvedValue(
      makeDescriptor({
        is_active: { type: 'bool' },
      }),
    )

    const result = await describeMethod('localhost:50051', false, 'UserService/GetUser')

    expect(JSON.parse(result)).toEqual({ is_active: false })
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npm run test -- --project main tests/main/grpc/describe.test.ts
```

期待: FAIL（`describeMethod` が存在しない）

- [ ] **Step 3: `describe.ts` を実装する**

```typescript
// src/main/grpc/describe.ts
import * as grpc from '@grpc/grpc-js'
import { GrpcReflection } from 'grpc-js-reflection-client'

interface ProtoField {
  type: string
  rule?: string
  resolvedType?: ProtoType | ProtoEnum
}
interface ProtoType {
  fields: Record<string, ProtoField>
}
interface ProtoEnum {
  values: Record<string, number>
}

const PRIMITIVE_DEFAULTS: Record<string, unknown> = {
  string: '',
  int32: 0,
  int64: 0,
  uint32: 0,
  uint64: 0,
  sint32: 0,
  sint64: 0,
  fixed32: 0,
  fixed64: 0,
  sfixed32: 0,
  sfixed64: 0,
  float: 0,
  double: 0,
  bool: false,
  bytes: '',
}

function buildTemplate(fields: Record<string, ProtoField>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [name, field] of Object.entries(fields)) {
    if (field.rule === 'repeated') {
      result[name] = []
    } else if (field.resolvedType && 'fields' in field.resolvedType) {
      result[name] = buildTemplate((field.resolvedType as ProtoType).fields)
    } else if (field.resolvedType) {
      result[name] = 0
    } else {
      result[name] = PRIMITIVE_DEFAULTS[field.type] ?? ''
    }
  }
  return result
}

export async function describeMethod(
  host: string,
  secure: boolean,
  method: string,
): Promise<string> {
  const [serviceName, methodName] = method.split('/')
  if (!serviceName || !methodName) return ''

  const credentials = secure
    ? grpc.credentials.createSsl()
    : grpc.credentials.createInsecure()

  try {
    const client = new GrpcReflection(host, credentials)
    const descriptor = await client.getDescriptorBySymbol(serviceName)
    const root = descriptor.getProtobufJsRoot()
    root.resolveAll()

    const service = root.lookupService(serviceName)
    const methodDef = service.methods[methodName] as { resolvedRequestType: ProtoType | null } | undefined
    if (!methodDef?.resolvedRequestType) return ''

    const template = buildTemplate(methodDef.resolvedRequestType.fields)
    return JSON.stringify(template, null, 2)
  } catch {
    return ''
  }
}
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npm run test -- --project main tests/main/grpc/describe.test.ts
```

期待: 7 tests PASS

- [ ] **Step 5: 全テストが通ることを確認する**

```bash
npm run test -- --project main
```

期待: 全テスト PASS

- [ ] **Step 6: コミットする**

```bash
git checkout -b feat/grpc-scratch-tab
git add src/main/grpc/describe.ts tests/main/grpc/describe.test.ts
git commit -m "feat: protoスキーマからJSONテンプレを生成するdescribeMethodを実装"
```

---

### Task 2: IPC 型・preload・ハンドラーの追加

**Files:**
- Modify: `src/shared/types/ipc.ts`
- Modify: `src/main/ipc/grpc.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: `ipc.ts` に `grpcDescribeMethod` を追加する**

`src/shared/types/ipc.ts` の `IpcApi` インターフェースに1行追加する：

```typescript
// 変更前
export interface IpcApi {
  // ... 既存のメソッド ...
  grpcReflect: (host: string, secure: boolean) => Promise<GrpcServiceInfo[]>
  grpcRequest: (params: GrpcRequestParams) => Promise<GrpcResponse>
  // ...
}

// 変更後（grpcReflect の次に追加）
export interface IpcApi {
  // ... 既存のメソッド ...
  grpcReflect: (host: string, secure: boolean) => Promise<GrpcServiceInfo[]>
  grpcDescribeMethod: (host: string, secure: boolean, method: string) => Promise<string>
  grpcRequest: (params: GrpcRequestParams) => Promise<GrpcResponse>
  // ...
}
```

- [ ] **Step 2: `ipc/grpc.ts` にハンドラーを追加する**

`src/main/ipc/grpc.ts` の先頭 import に `describeMethod` を追加し、ハンドラーを登録する：

```typescript
// 変更前
import { reflectServices } from '../grpc/reflection'
import { executeGrpcRequest } from '../grpc/client'

// 変更後
import { reflectServices } from '../grpc/reflection'
import { describeMethod } from '../grpc/describe'
import { executeGrpcRequest } from '../grpc/client'
```

`registerGrpcHandlers` 関数内に追加：

```typescript
export function registerGrpcHandlers(): void {
  ipcMain.handle('grpc:reflect', async (_event, host: string, secure: boolean) => {
    return reflectServices(host, secure)
  })

  // ↓ この1ブロックを追加
  ipcMain.handle('grpc:describeMethod', async (_event, host: string, secure: boolean, method: string) => {
    return describeMethod(host, secure, method)
  })

  ipcMain.handle('grpc:request', async (_event, params: GrpcRequestParams) => {
    return executeGrpcRequest(params)
  })
}
```

- [ ] **Step 3: `preload/index.ts` に追加する**

`src/preload/index.ts` の `api` オブジェクトに追加する：

```typescript
const api: IpcApi = {
  openProject: () => ipcRenderer.invoke('project:open'),
  saveProject: (project) => ipcRenderer.invoke('project:save', project),
  listCases: (casesDir) => ipcRenderer.invoke('project:listCases', casesDir),
  readCase: (absolutePath) => ipcRenderer.invoke('project:readCase', absolutePath),
  writeCase: (absolutePath, content) =>
    ipcRenderer.invoke('project:writeCase', absolutePath, content),
  grpcReflect: (host, secure) => ipcRenderer.invoke('grpc:reflect', host, secure),
  grpcDescribeMethod: (host, secure, method) =>
    ipcRenderer.invoke('grpc:describeMethod', host, secure, method),
  grpcRequest: (params) => ipcRenderer.invoke('grpc:request', params),
  writeLog: (projectDir, entry) => ipcRenderer.invoke('log:write', projectDir, entry),
  readLogs: (projectDir, date) => ipcRenderer.invoke('log:read', projectDir, date),
}
```

- [ ] **Step 4: 全テストが通ることを確認する**

```bash
npm run test
```

期待: 全テスト PASS

- [ ] **Step 5: コミットする**

```bash
git add src/shared/types/ipc.ts src/main/ipc/grpc.ts src/preload/index.ts
git commit -m "feat: grpc:describeMethod IPCハンドラーを追加"
```

---

### Task 3: `Tab` 型の拡張と `replaceTab` の追加

**Files:**
- Modify: `src/renderer/src/store/appStore.ts`
- Modify: `tests/renderer/store/appStore.test.ts`

- [ ] **Step 1: `appStore.test.ts` を更新する（既存テストの移行 + 新テスト）**

既存テストの `openTab` 呼び出しに `type: 'case'` を追加し、新しいテストを末尾に追加する。ファイル全体を以下で置き換える：

```typescript
// tests/renderer/store/appStore.test.ts
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
    act(() =>
      result.current.openTab({
        type: 'case',
        id: 'tab-1',
        label: 'GetUser',
        endpointId: 'ep-1',
        caseName: 'UserA.yaml',
      }),
    )
    expect(result.current.openTabs).toHaveLength(1)
    expect(result.current.activeTabId).toBe('tab-1')
  })

  it('同じタブを二重に開かない', () => {
    const { result } = renderHook(() => useAppStore())
    const tab = {
      type: 'case' as const,
      id: 'tab-1',
      label: 'GetUser',
      endpointId: 'ep-1',
      caseName: 'UserA.yaml',
    }
    act(() => result.current.openTab(tab))
    act(() => result.current.openTab(tab))
    expect(result.current.openTabs).toHaveLength(1)
  })

  it('タブを閉じる', () => {
    const { result } = renderHook(() => useAppStore())
    act(() =>
      result.current.openTab({
        type: 'case',
        id: 'tab-1',
        label: 'GetUser',
        endpointId: 'ep-1',
        caseName: 'UserA.yaml',
      }),
    )
    act(() => result.current.closeTab('tab-1'))
    expect(result.current.openTabs).toHaveLength(0)
    expect(result.current.activeTabId).toBeNull()
  })

  it('複数タブがある時にアクティブタブを閉じると最後のタブがアクティブになる', () => {
    const { result } = renderHook(() => useAppStore())
    act(() =>
      result.current.openTab({
        type: 'case',
        id: 'tab-1',
        label: 'GetUser',
        endpointId: 'ep-1',
        caseName: 'UserA.yaml',
      }),
    )
    act(() =>
      result.current.openTab({
        type: 'case',
        id: 'tab-2',
        label: 'ListUsers',
        endpointId: 'ep-2',
        caseName: 'All.yaml',
      }),
    )
    act(() => result.current.closeTab('tab-2'))
    expect(result.current.openTabs).toHaveLength(1)
    expect(result.current.activeTabId).toBe('tab-1')
  })

  it('スクラッチタブを開く', () => {
    const { result } = renderHook(() => useAppStore())
    act(() =>
      result.current.openTab({
        type: 'scratch',
        id: 'scratch::ep-1',
        label: 'GetUser',
        endpointId: 'ep-1',
      }),
    )
    expect(result.current.openTabs).toHaveLength(1)
    expect(result.current.openTabs[0].type).toBe('scratch')
    expect(result.current.activeTabId).toBe('scratch::ep-1')
  })

  it('replaceTab でスクラッチタブをケースタブに変換する', () => {
    const { result } = renderHook(() => useAppStore())
    act(() =>
      result.current.openTab({
        type: 'scratch',
        id: 'scratch::ep-1',
        label: 'GetUser',
        endpointId: 'ep-1',
      }),
    )
    act(() =>
      result.current.replaceTab('scratch::ep-1', {
        type: 'case',
        id: 'ep-1::test.yaml',
        label: 'GetUser / test',
        endpointId: 'ep-1',
        caseName: 'test.yaml',
      }),
    )
    expect(result.current.openTabs).toHaveLength(1)
    expect(result.current.openTabs[0].type).toBe('case')
    expect(result.current.activeTabId).toBe('ep-1::test.yaml')
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npm run test -- --project renderer tests/renderer/store/appStore.test.ts
```

期待: FAIL（`type` フィールドが存在しない、`replaceTab` が存在しない）

- [ ] **Step 3: `appStore.ts` の Tab 型と `replaceTab` を実装する**

`src/renderer/src/store/appStore.ts` を以下に書き換える：

```typescript
import { create } from 'zustand'

export type Protocol = 'grpc' | 'graphql' | 'http'

export interface CaseTab {
  type: 'case'
  id: string
  label: string
  endpointId: string
  caseName: string
}

export interface ScratchTab {
  type: 'scratch'
  id: string
  label: string
  endpointId: string
}

export type Tab = CaseTab | ScratchTab

interface AppState {
  activeProtocol: Protocol
  activeEnvironmentId: string | null
  activeProtocolTargetId: string | null
  openTabs: Tab[]
  activeTabId: string | null
  setActiveProtocol: (protocol: Protocol) => void
  setActiveEnvironmentId: (id: string | null) => void
  setActiveProtocolTargetId: (id: string | null) => void
  openTab: (tab: Tab) => void
  closeTab: (id: string) => void
  replaceTab: (oldId: string, newTab: Tab) => void
  setActiveTabId: (id: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeProtocol: 'grpc',
  activeEnvironmentId: null,
  activeProtocolTargetId: null,
  openTabs: [],
  activeTabId: null,
  setActiveProtocol: (protocol) =>
    set({ activeProtocol: protocol, openTabs: [], activeTabId: null }),
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
  replaceTab: (oldId, newTab) =>
    set((state) => ({
      openTabs: state.openTabs.map((t) => (t.id === oldId ? newTab : t)),
      activeTabId: state.activeTabId === oldId ? newTab.id : state.activeTabId,
    })),
  setActiveTabId: (id) => set({ activeTabId: id }),
}))
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npm run test -- --project renderer tests/renderer/store/appStore.test.ts
```

期待: 7 tests PASS

- [ ] **Step 5: 全テストが通ることを確認する**

```bash
npm run test
```

期待: 全テスト PASS

- [ ] **Step 6: コミットする**

```bash
git add src/renderer/src/store/appStore.ts tests/renderer/store/appStore.test.ts
git commit -m "feat: Tab型をCaseTab/ScratchTabのunionに変更しreplaceTabを追加"
```

---

### Task 4: CollectionTree にスクラッチタブを開く動作を追加

**Files:**
- Modify: `src/renderer/src/components/Sidebar/CollectionTree.tsx`

- [ ] **Step 1: `handleCaseClick` を `type: 'case'` に移行し、エンドポイントクリックでスクラッチタブを開くよう変更する**

`src/renderer/src/components/Sidebar/CollectionTree.tsx` を以下のように変更する。

`handleCaseClick` 内の `openTab` 呼び出し（現在 `type` なし）に `type: 'case'` を追加する：

```typescript
// 変更前
const handleCaseClick = (_col: Collection, ep: GrpcEndpoint, caseName: string): void => {
  openTab({
    id: `${ep.id}::${caseName}`,
    label: `${ep.name} / ${caseName.replace(/\.ya?ml$/, '')}`,
    endpointId: ep.id,
    caseName,
  })
}

// 変更後
const handleCaseClick = (_col: Collection, ep: GrpcEndpoint, caseName: string): void => {
  openTab({
    type: 'case',
    id: `${ep.id}::${caseName}`,
    label: `${ep.name} / ${caseName.replace(/\.ya?ml$/, '')}`,
    endpointId: ep.id,
    caseName,
  })
}
```

エンドポイントボタンの `onClick` を変更して、展開に加えてスクラッチタブを開く：

```typescript
// 変更前
<button
  type="button"
  className="flex min-w-0 flex-1 items-center text-left text-[var(--color-text-primary)]"
  onClick={() => toggleEndpoint(ep)}
>

// 変更後
<button
  type="button"
  className="flex min-w-0 flex-1 items-center text-left text-[var(--color-text-primary)]"
  onClick={() => {
    void toggleEndpoint(ep)
    openTab({
      type: 'scratch',
      id: `scratch::${ep.id}`,
      label: ep.name,
      endpointId: ep.id,
    })
  }}
>
```

- [ ] **Step 2: 全テストが通ることを確認する**

```bash
npm run test
```

期待: 全テスト PASS

- [ ] **Step 3: コミットする**

```bash
git add src/renderer/src/components/Sidebar/CollectionTree.tsx
git commit -m "feat: エンドポイントクリックでスクラッチタブを開く"
```

---

### Task 5: GrpcPanel のスクラッチタブ対応

**Files:**
- Modify: `src/renderer/src/components/MainPanel/GrpcPanel/RequestEditor.tsx`
- Modify: `src/renderer/src/components/MainPanel/GrpcPanel/index.tsx`
- Modify: `src/renderer/src/components/MainPanel/index.tsx`

- [ ] **Step 1: `RequestEditor.tsx` に `language` prop を追加する**

`src/renderer/src/components/MainPanel/GrpcPanel/RequestEditor.tsx` を以下に書き換える：

```typescript
import { useState, type JSX } from 'react'
import { MonacoEditor } from '../../shared/MonacoEditor'
import { MetadataEditor } from './MetadataEditor'
import type { Tab } from '../../../store/appStore'

type TabName = 'request' | 'metadata'

interface Props {
  tab: Tab
  body: string
  metadata: Record<string, string>
  language: string
  onBodyChange: (body: string) => void
  onMetadataChange: (metadata: Record<string, string>) => void
}

export function RequestEditor({
  tab: _tab,
  body,
  metadata,
  language,
  onBodyChange,
  onMetadataChange,
}: Props): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabName>('request')

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-2 border-b border-[var(--color-border)] px-3 py-1 text-xs">
        {(['request', 'metadata'] as TabName[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={
              activeTab === t
                ? 'text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-secondary)]'
            }
          >
            {t === 'request' ? 'Request' : 'Metadata'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {activeTab === 'request' && (
          <MonacoEditor value={body} onChange={(v) => onBodyChange(v ?? '')} language={language} />
        )}
        {activeTab === 'metadata' && (
          <MetadataEditor metadata={metadata} onChange={onMetadataChange} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: `GrpcPanel/index.tsx` をスクラッチタブ対応に書き換える**

`src/renderer/src/components/MainPanel/GrpcPanel/index.tsx` を以下に書き換える：

```typescript
import { useState, useEffect, useCallback, type JSX } from 'react'
import { RequestEditor } from './RequestEditor'
import { ResponseViewer } from './ResponseViewer'
import { useAppStore, type Tab } from '../../../store/appStore'
import { useProjectStore } from '../../../store/projectStore'
import type { GrpcResponse, GrpcRequestParams, LogEntry } from '../../../../../shared/types/ipc'
import type { GrpcTarget } from '../../../../../shared/types/project'
import * as path from 'path'

interface Props {
  tab: Tab
}

export function GrpcPanel({ tab }: Props): JSX.Element {
  const project = useProjectStore((s) => s.project)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const activeProtocolTargetId = useAppStore((s) => s.activeProtocolTargetId)
  const replaceTab = useAppStore((s) => s.replaceTab)

  const [body, setBody] = useState<string>('')
  const [metadata, setMetadata] = useState<Record<string, string>>({})
  const [response, setResponse] = useState<GrpcResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isTemplateLoading, setIsTemplateLoading] = useState<boolean>(false)
  const [saveNameInput, setSaveNameInput] = useState<string>('')
  const [isSaving, setIsSaving] = useState<boolean>(false)

  const endpoint = project?.collections
    .flatMap((c) => c.endpoints)
    .find((ep) => ep.id === tab.endpointId)

  const collection = project?.collections.find((c) =>
    c.endpoints.some((ep) => ep.id === tab.endpointId),
  )

  const activeEnv =
    project?.environments.find((e) => e.id === activeEnvironmentId) ?? project?.environments[0]
  const grpcTargets = (activeEnv?.protocols?.grpc as GrpcTarget[] | undefined) ?? []
  const activeTarget =
    grpcTargets.find((t) => t.id === activeProtocolTargetId) ?? grpcTargets[0]

  useEffect(() => {
    if (!project || !endpoint) return

    if (tab.type === 'case') {
      const filePath = path.join(project.projectDir, endpoint.casesDir, tab.caseName)
      window.reqstraApi.readCase(filePath).then(setBody).catch(() => setBody(''))
      return
    }

    // scratch tab: fetch JSON template from proto schema
    if (!activeTarget) {
      setBody('')
      return
    }
    setIsTemplateLoading(true)
    window.reqstraApi
      .grpcDescribeMethod(activeTarget.host, activeTarget.secure, endpoint.method)
      .then((template) => setBody(template))
      .catch(() => setBody(''))
      .finally(() => setIsTemplateLoading(false))
  }, [tab.id, project, endpoint, activeTarget])

  const handleBodyChange = useCallback(
    (newBody: string): void => {
      setBody(newBody)
      if (tab.type !== 'case' || !project || !endpoint) return
      const filePath = path.join(project.projectDir, endpoint.casesDir, tab.caseName)
      window.reqstraApi.writeCase(filePath, newBody).catch(console.error)
    },
    [project, endpoint, tab],
  )

  const handleSave = async (): Promise<void> => {
    const rawName = saveNameInput.trim()
    if (!rawName || !project || !endpoint) return
    const caseName = rawName.endsWith('.yaml') ? rawName : `${rawName}.yaml`
    const filePath = path.join(project.projectDir, endpoint.casesDir, caseName)

    setIsSaving(true)
    try {
      await window.reqstraApi.writeCase(filePath, body)
      replaceTab(tab.id, {
        type: 'case',
        id: `${endpoint.id}::${caseName}`,
        label: `${endpoint.name} / ${rawName.replace(/\.ya?ml$/, '')}`,
        endpointId: endpoint.id,
        caseName,
      })
    } catch (e) {
      console.error(e)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSend = async (): Promise<void> => {
    if (!project || !endpoint || !collection) return

    if (!activeTarget) {
      setResponse({
        status: 'ERROR',
        body: null,
        trailers: {},
        durationMs: 0,
        error: 'gRPCターゲットが設定されていません',
      })
      return
    }

    const params: GrpcRequestParams = {
      host: activeTarget.host,
      secure: activeTarget.secure,
      method: endpoint.method,
      body,
      metadata,
    }

    setIsLoading(true)
    let result: GrpcResponse
    try {
      result = await window.reqstraApi.grpcRequest(params)
    } finally {
      setIsLoading(false)
    }
    setResponse(result)

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      protocol: 'grpc',
      collectionName: collection.name,
      endpointName: endpoint.name,
      caseName: tab.type === 'case' ? tab.caseName : '(scratch)',
      status: result.status,
      durationMs: result.durationMs,
      request: params.body,
      response: result.body,
    }
    window.reqstraApi.writeLog(project.projectDir, logEntry).catch(console.error)
  }

  const language = tab.type === 'scratch' ? 'json' : 'yaml'

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
        <span className="rounded bg-[#0e639c] px-2 py-0.5 text-xs font-medium text-white">
          gRPC
        </span>
        <span className="flex-1 truncate text-xs text-[var(--color-text-secondary)]">
          {endpoint?.method ?? tab.label}
        </span>

        {tab.type === 'scratch' && (
          <>
            {isSaving ? (
              <span className="text-xs text-[var(--color-text-secondary)]">保存中...</span>
            ) : saveNameInput !== '' || true ? (
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
                  className="rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-0.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-accent)] w-32"
                />
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={!saveNameInput.trim() || isSaving}
                  className="rounded bg-[var(--color-bg-active)] px-2 py-0.5 text-xs text-white disabled:opacity-50"
                >
                  保存
                </button>
              </div>
            ) : null}
          </>
        )}

        <button
          onClick={() => void handleSend()}
          disabled={isLoading || isTemplateLoading}
          className="rounded bg-[#0e639c] px-4 py-1 text-xs text-white hover:bg-[#1177bb] disabled:opacity-50"
        >
          {isTemplateLoading ? '読込中...' : '▶ Send'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden border-r border-[var(--color-border)]">
          <RequestEditor
            tab={tab}
            body={body}
            metadata={metadata}
            language={language}
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

- [ ] **Step 3: `MainPanel/index.tsx` のプレースホルダーテキストを更新する**

`src/renderer/src/components/MainPanel/index.tsx` の `!activeTab` 時のメッセージを変更する：

```typescript
// 変更前
{!activeTab && (
  <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">
    <p className="text-sm">サイドバーからケースを選択してください</p>
  </div>
)}

// 変更後
{!activeTab && (
  <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">
    <p className="text-sm">サイドバーからエンドポイントまたはケースを選択してください</p>
  </div>
)}
```

- [ ] **Step 4: 全テストが通ることを確認する**

```bash
npm run test
```

期待: 全テスト PASS

- [ ] **Step 5: コミットする**

```bash
git add \
  src/renderer/src/components/MainPanel/GrpcPanel/RequestEditor.tsx \
  src/renderer/src/components/MainPanel/GrpcPanel/index.tsx \
  src/renderer/src/components/MainPanel/index.tsx
git commit -m "feat: GrpcPanelにスクラッチタブ対応とSaveボタンを追加"
```
