# gRPCリクエスト機能改善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** gRPCリクエスト画面にエンドポイント表示・ペインリサイズ・コレクションフィルタリング・Metadataインライン編集を追加する。

**Architecture:** 既存のデータモデル（reqstra-project.json）を維持しつつ、Main Processにディスクスキャン関数を追加。起動時にスキャン結果をZustandストアに保持しCollectionTreeでフィルタリングする。ペインリサイズは新規`ResizablePanes`コンポーネントで実装。

**Tech Stack:** Electron + React 18 + TypeScript + Zustand + TailwindCSS + vitest

---

## ファイルマップ

| ファイル | 操作 | 内容 |
|---|---|---|
| `src/shared/types/ipc.ts` | 変更 | `IpcApi`に`scanCaseDirs`追加 |
| `src/main/ipc/grpc.ts` | 変更 | `scanCaseDirs`関数と`grpc:scanCaseDirs`ハンドラを追加 |
| `src/main/ipc/index.ts` | 変更 | `scanCaseDirs`のIPCハンドラを登録 |
| `src/preload/index.ts` | 変更 | `scanCaseDirs`をcontextBridgeに追加 |
| `src/renderer/src/store/projectStore.ts` | 変更 | `activeCaseDirs`・`setActiveCaseDirs`を追加 |
| `src/renderer/src/App.tsx` | 変更 | プロジェクト読み込み時に`scanCaseDirs`を呼び出す・サイドバーリサイズ適用 |
| `src/renderer/src/components/Sidebar/index.tsx` | 変更 | `w-52`を`w-full`に変更（リサイズ対応） |
| `src/renderer/src/components/shared/ResizablePanes.tsx` | **新規** | ドラッグリサイズコンポーネント |
| `src/renderer/src/components/MainPanel/GrpcPanel/index.tsx` | 変更 | エンドポイント表示・レスポンスペインリサイズ適用 |
| `src/renderer/src/components/Sidebar/CollectionTree.tsx` | 変更 | 削除ボタン非表示・フィルタリング・マージ変更 |
| `src/renderer/src/components/MainPanel/GrpcPanel/MetadataEditor.tsx` | 変更 | 既存エントリをinput化 |
| `tests/main/ipc/grpc.test.ts` | **新規** | `scanCaseDirs`のユニットテスト |

---

## Task 1: IPC型定義・preload に `scanCaseDirs` を追加

**Files:**
- Modify: `src/shared/types/ipc.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: `IpcApi` に `scanCaseDirs` を追加**

`src/shared/types/ipc.ts` の `IpcApi` インターフェースに追加：

```typescript
export interface IpcApi {
  openProject: () => Promise<ReqstraProject | null>
  saveProject: (project: ReqstraProject) => Promise<void>
  readCase: (absolutePath: string) => Promise<string>
  writeCase: (absolutePath: string, content: string) => Promise<void>
  deleteCase: (absolutePath: string) => Promise<void>
  listCases: (absoluteCasesDir: string) => Promise<string[]>
  scanCaseDirs: (projectDir: string) => Promise<string[]>   // ← 追加
  grpcReflect: (host: string, secure: boolean) => Promise<GrpcServiceInfo[]>
  grpcDescribeMethod: (host: string, secure: boolean, method: string) => Promise<string>
  grpcRequest: (params: GrpcRequestParams) => Promise<GrpcResponse>
  writeLog: (projectDir: string, entry: LogEntry) => Promise<void>
  readLogs: (projectDir: string, date: string) => Promise<LogEntry[]>
}
```

- [ ] **Step 2: preload に `scanCaseDirs` を追加**

`src/preload/index.ts` の `api` オブジェクトに追加：

```typescript
const api: IpcApi = {
  openProject: () => ipcRenderer.invoke('project:open'),
  saveProject: (project) => ipcRenderer.invoke('project:save', project),
  listCases: (casesDir) => ipcRenderer.invoke('project:listCases', casesDir),
  readCase: (absolutePath) => ipcRenderer.invoke('project:readCase', absolutePath),
  writeCase: (absolutePath, content) =>
    ipcRenderer.invoke('project:writeCase', absolutePath, content),
  deleteCase: (absolutePath) => ipcRenderer.invoke('project:deleteCase', absolutePath),
  scanCaseDirs: (projectDir) => ipcRenderer.invoke('grpc:scanCaseDirs', projectDir),  // ← 追加
  grpcReflect: (host, secure) => ipcRenderer.invoke('grpc:reflect', host, secure),
  grpcDescribeMethod: (host, secure, method) =>
    ipcRenderer.invoke('grpc:describeMethod', host, secure, method),
  grpcRequest: (params) => ipcRenderer.invoke('grpc:request', params),
  writeLog: (projectDir, entry) => ipcRenderer.invoke('log:write', projectDir, entry),
  readLogs: (projectDir, date) => ipcRenderer.invoke('log:read', projectDir, date),
}
```

- [ ] **Step 3: TypeScriptエラーがないことを確認**

```bash
npm run typecheck 2>/dev/null || npx tsc --noEmit
```

Expected: エラーなし（`grpc:scanCaseDirs`ハンドラはTask 2で実装するが型定義は通る）

- [ ] **Step 4: コミット**

```bash
git add src/shared/types/ipc.ts src/preload/index.ts
git commit -m "feat: IpcApiにscanCaseDirsを追加"
```

---

## Task 2: `scanCaseDirs` のMain Process実装（TDD）

**Files:**
- Create: `tests/main/ipc/grpc.test.ts`
- Modify: `src/main/ipc/grpc.ts`
- Modify: `src/main/ipc/index.ts`

- [ ] **Step 1: テストファイルを作成（失敗するテストを書く）**

`tests/main/ipc/grpc.test.ts` を新規作成：

```typescript
import { describe, it, expect } from 'vitest'
import { promises as fs } from 'fs'
import * as os from 'os'
import * as path from 'path'
import { scanCaseDirs } from '../../../src/main/ipc/grpc'

const tmpDir = () => fs.mkdtemp(path.join(os.tmpdir(), 'reqstra-test-grpc-'))

describe('scanCaseDirs', () => {
  it('ケースファイルがあるエンドポイントのcasesDirを返す', async () => {
    const dir = await tmpDir()
    const caseDir = path.join(dir, 'requests', 'grpc', 'UserService', 'GetUser')
    await fs.mkdir(caseDir, { recursive: true })
    await fs.writeFile(path.join(caseDir, 'case1.yaml'), 'id: 1')

    const result = await scanCaseDirs(dir)

    expect(result).toContain('requests/grpc/UserService/GetUser')
  })

  it('ケースファイルがないエンドポイントは含まれない', async () => {
    const dir = await tmpDir()
    const caseDir = path.join(dir, 'requests', 'grpc', 'EmptyService', 'EmptyMethod')
    await fs.mkdir(caseDir, { recursive: true })

    const result = await scanCaseDirs(dir)

    expect(result).not.toContain('requests/grpc/EmptyService/EmptyMethod')
  })

  it('requests/grpcディレクトリが存在しない場合は空配列を返す', async () => {
    const dir = await tmpDir()

    const result = await scanCaseDirs(dir)

    expect(result).toEqual([])
  })

  it('.ymlファイルもケースファイルとして認識する', async () => {
    const dir = await tmpDir()
    const caseDir = path.join(dir, 'requests', 'grpc', 'OrderService', 'GetOrder')
    await fs.mkdir(caseDir, { recursive: true })
    await fs.writeFile(path.join(caseDir, 'case.yml'), 'id: 2')

    const result = await scanCaseDirs(dir)

    expect(result).toContain('requests/grpc/OrderService/GetOrder')
  })

  it('複数のサービス・メソッドを正しく列挙する', async () => {
    const dir = await tmpDir()
    await fs.mkdir(path.join(dir, 'requests', 'grpc', 'UserService', 'GetUser'), { recursive: true })
    await fs.mkdir(path.join(dir, 'requests', 'grpc', 'UserService', 'CreateUser'), { recursive: true })
    await fs.writeFile(path.join(dir, 'requests', 'grpc', 'UserService', 'GetUser', 'a.yaml'), '')
    await fs.writeFile(path.join(dir, 'requests', 'grpc', 'UserService', 'CreateUser', 'b.yaml'), '')

    const result = await scanCaseDirs(dir)

    expect(result).toContain('requests/grpc/UserService/GetUser')
    expect(result).toContain('requests/grpc/UserService/CreateUser')
    expect(result).toHaveLength(2)
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npm run test -- --project main tests/main/ipc/grpc.test.ts
```

Expected: FAIL（`scanCaseDirs`が未定義）

- [ ] **Step 3: `scanCaseDirs` を実装**

`src/main/ipc/grpc.ts` を以下に変更：

```typescript
import { ipcMain } from 'electron'
import { promises as fs } from 'fs'
import * as path from 'path'
import { reflectServices } from '../grpc/reflection'
import { describeMethod } from '../grpc/describe'
import { executeGrpcRequest } from '../grpc/client'
import type { GrpcRequestParams } from '../../shared/types/ipc'

export async function scanCaseDirs(projectDir: string): Promise<string[]> {
  const grpcDir = path.join(projectDir, 'requests', 'grpc')
  const result: string[] = []

  let serviceNames: string[]
  try {
    serviceNames = await fs.readdir(grpcDir)
  } catch {
    return []
  }

  for (const serviceName of serviceNames) {
    const serviceDir = path.join(grpcDir, serviceName)
    try {
      const stat = await fs.stat(serviceDir)
      if (!stat.isDirectory()) continue
    } catch {
      continue
    }

    let methodNames: string[]
    try {
      methodNames = await fs.readdir(serviceDir)
    } catch {
      continue
    }

    for (const methodName of methodNames) {
      const methodDir = path.join(serviceDir, methodName)
      try {
        const stat = await fs.stat(methodDir)
        if (!stat.isDirectory()) continue
      } catch {
        continue
      }

      let files: string[]
      try {
        files = await fs.readdir(methodDir)
      } catch {
        continue
      }

      const hasCase = files.some((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
      if (hasCase) {
        result.push(`requests/grpc/${serviceName}/${methodName}`)
      }
    }
  }

  return result
}

export function registerGrpcHandlers(): void {
  ipcMain.handle('grpc:reflect', async (_event, host: string, secure: boolean) => {
    return reflectServices(host, secure)
  })

  ipcMain.handle('grpc:describeMethod', async (_event, host: string, secure: boolean, method: string) => {
    return describeMethod(host, secure, method)
  })

  ipcMain.handle('grpc:request', async (_event, params: GrpcRequestParams) => {
    return executeGrpcRequest(params)
  })

  ipcMain.handle('grpc:scanCaseDirs', async (_event, projectDir: string) => {
    return scanCaseDirs(projectDir)
  })
}
```

- [ ] **Step 4: テストがパスすることを確認**

```bash
npm run test -- --project main tests/main/ipc/grpc.test.ts
```

Expected: PASS（5件すべてグリーン）

- [ ] **Step 5: コミット**

```bash
git add tests/main/ipc/grpc.test.ts src/main/ipc/grpc.ts
git commit -m "feat: scanCaseDirsをMain Processに実装"
```

---

## Task 3: projectStore に `activeCaseDirs` 追加 + App.tsx でトリガー

**Files:**
- Modify: `src/renderer/src/store/projectStore.ts`
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: projectStoreにフィールドとアクションを追加**

`src/renderer/src/store/projectStore.ts` の `ProjectState` インターフェースに追加：

```typescript
interface ProjectState {
  project: ReqstraProject | null
  activeCaseDirs: Set<string>           // ← 追加
  setProject: (project: ReqstraProject) => void
  setActiveCaseDirs: (dirs: string[]) => void  // ← 追加
  updateCollection: (collection: Collection) => void
  // ... 以下既存
```

`create<ProjectState>` の初期値と実装を追加：

```typescript
export const useProjectStore = create<ProjectState>((set) => ({
  project: null,
  activeCaseDirs: new Set<string>(),    // ← 追加
  setProject: (project) => set({ project }),
  setActiveCaseDirs: (dirs) => set({ activeCaseDirs: new Set(dirs) }),  // ← 追加
  // ... 以下既存のまま
```

- [ ] **Step 2: App.tsx でプロジェクト読み込み時に scanCaseDirs を呼び出す**

`src/renderer/src/App.tsx` を以下に変更：

```typescript
import type { JSX } from 'react'
import { ActivityBar } from './components/ActivityBar'
import { Sidebar } from './components/Sidebar'
import { MainPanel } from './components/MainPanel'
import { useProjectStore } from './store/projectStore'

export default function App(): JSX.Element {
  const project = useProjectStore((s) => s.project)
  const setProject = useProjectStore((s) => s.setProject)
  const setActiveCaseDirs = useProjectStore((s) => s.setActiveCaseDirs)

  const handleOpenProject = async (): Promise<void> => {
    const result = await window.reqstraApi.openProject()
    if (result) {
      setProject(result)
      const dirs = await window.reqstraApi.scanCaseDirs(result.projectDir)
      setActiveCaseDirs(dirs)
    }
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

- [ ] **Step 3: TypeScriptエラーがないことを確認**

```bash
npx tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/renderer/src/store/projectStore.ts src/renderer/src/App.tsx
git commit -m "feat: projectStoreにactiveCaseDirsを追加してプロジェクト読み込み時にスキャン"
```

---

## Task 4: `ResizablePanes` コンポーネント新規作成

**Files:**
- Create: `src/renderer/src/components/shared/ResizablePanes.tsx`

- [ ] **Step 1: ResizablePanes コンポーネントを作成**

`src/renderer/src/components/shared/ResizablePanes.tsx` を新規作成：

```typescript
import { useState, useCallback, useEffect, useRef, type JSX } from 'react'

interface Props {
  defaultLeftWidth: number
  minLeft?: number
  minRight?: number
  storageKey?: string
  children: [React.ReactNode, React.ReactNode]
}

export function ResizablePanes({
  defaultLeftWidth,
  minLeft = 120,
  minRight = 200,
  storageKey,
  children,
}: Props): JSX.Element {
  const stored = storageKey
    ? Number(localStorage.getItem(storageKey)) || defaultLeftWidth
    : defaultLeftWidth
  const [leftWidth, setLeftWidth] = useState<number>(stored)
  const isDragging = useRef<boolean>(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent): void => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      if (!isDragging.current || !containerRef.current) return
      const containerLeft = containerRef.current.getBoundingClientRect().left
      const containerWidth = containerRef.current.clientWidth
      const newWidth = Math.max(
        minLeft,
        Math.min(e.clientX - containerLeft, containerWidth - minRight - 4),
      )
      setLeftWidth(newWidth)
      if (storageKey) localStorage.setItem(storageKey, String(newWidth))
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
  }, [minLeft, minRight, storageKey])

  return (
    <div ref={containerRef} className="flex h-full overflow-hidden">
      <div style={{ width: leftWidth, minWidth: minLeft, flexShrink: 0 }} className="overflow-hidden">
        {children[0]}
      </div>
      <div
        style={{ width: 4, cursor: 'col-resize', flexShrink: 0 }}
        className="bg-transparent transition-colors hover:bg-[var(--color-text-accent)] active:bg-[var(--color-text-accent)]"
        onMouseDown={handleMouseDown}
      />
      <div className="min-w-0 flex-1 overflow-hidden">
        {children[1]}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScriptエラーがないことを確認**

```bash
npx tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/renderer/src/components/shared/ResizablePanes.tsx
git commit -m "feat: ResizablePanesドラッグリサイズコンポーネントを追加"
```

---

## Task 5: App.tsx にサイドバー↔メインのリサイズを適用

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/components/Sidebar/index.tsx`

- [ ] **Step 1: Sidebar の固定幅クラスを削除**

`src/renderer/src/components/Sidebar/index.tsx` の `w-52` を `w-full` に変更：

```typescript
return (
  <div className="flex w-full flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
```

- [ ] **Step 2: App.tsx に ResizablePanes を適用**

`src/renderer/src/App.tsx` のプロジェクト表示部分を変更：

```typescript
import type { JSX } from 'react'
import { ActivityBar } from './components/ActivityBar'
import { Sidebar } from './components/Sidebar'
import { MainPanel } from './components/MainPanel'
import { ResizablePanes } from './components/shared/ResizablePanes'
import { useProjectStore } from './store/projectStore'

export default function App(): JSX.Element {
  const project = useProjectStore((s) => s.project)
  const setProject = useProjectStore((s) => s.setProject)
  const setActiveCaseDirs = useProjectStore((s) => s.setActiveCaseDirs)

  const handleOpenProject = async (): Promise<void> => {
    const result = await window.reqstraApi.openProject()
    if (result) {
      setProject(result)
      const dirs = await window.reqstraApi.scanCaseDirs(result.projectDir)
      setActiveCaseDirs(dirs)
    }
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
      <ResizablePanes
        defaultLeftWidth={240}
        minLeft={160}
        minRight={400}
        storageKey="pane-sidebar-width"
      >
        <Sidebar />
        <MainPanel />
      </ResizablePanes>
    </div>
  )
}
```

- [ ] **Step 3: 開発サーバーを起動して動作確認**

```bash
npm run dev
```

確認項目：
- サイドバーとメインパネルの境界線をドラッグして幅が変わること
- アプリ再起動後も幅が維持されること（localStorageに保存）
- サイドバーが 160px 以下・メインが 400px 以下にならないこと

- [ ] **Step 4: コミット**

```bash
git add src/renderer/src/App.tsx src/renderer/src/components/Sidebar/index.tsx
git commit -m "feat: サイドバー↔メインパネルのリサイズを実装"
```

---

## Task 6: GrpcPanel にエンドポイント表示 + リクエスト↔レスポンスリサイズ適用

**Files:**
- Modify: `src/renderer/src/components/MainPanel/GrpcPanel/index.tsx`

- [ ] **Step 1: GrpcPanel を更新**

`src/renderer/src/components/MainPanel/GrpcPanel/index.tsx` を以下に変更。変更点は2箇所：
1. エンドポイント表示（host + method）
2. リクエスト/レスポンスを `ResizablePanes` で囲む

```typescript
import { useState, useEffect, useCallback, type JSX } from 'react'
import { RequestEditor } from './RequestEditor'
import { ResponseViewer } from './ResponseViewer'
import { ResizablePanes } from '../../shared/ResizablePanes'
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
  const [saveError, setSaveError] = useState<string | null>(null)

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

  const endpointLabel = endpoint
    ? `${activeTarget ? activeTarget.host : '(ターゲット未設定)'} / ${endpoint.method}`
    : tab.label

  useEffect(() => {
    if (!project || !endpoint) return

    if (tab.type === 'case') {
      const filePath = path.join(project.projectDir, endpoint.casesDir, tab.caseName)
      window.reqstraApi.readCase(filePath).then(setBody).catch(() => setBody(''))
      return
    }

    if (!activeTarget) {
      setBody('')
      return
    }
    setIsTemplateLoading(true)
    window.reqstraApi
      .grpcDescribeMethod(activeTarget.host, activeTarget.secure, endpoint.method)
      .then((template) => setBody((prev) => prev || template))
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
    setSaveError(null)
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
      setSaveError(e instanceof Error ? e.message : String(e))
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
          onClick={() => void handleSend()}
          disabled={isLoading || isTemplateLoading}
          className="rounded bg-[#0e639c] px-4 py-1 text-xs text-white hover:bg-[#1177bb] disabled:opacity-50"
        >
          {isTemplateLoading ? '読込中...' : '▶ Send'}
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <ResizablePanes
          defaultLeftWidth={480}
          minLeft={200}
          minRight={200}
          storageKey="pane-response-width"
        >
          <RequestEditor
            tab={tab}
            body={body}
            metadata={metadata}
            language={language}
            onBodyChange={handleBodyChange}
            onMetadataChange={setMetadata}
          />
          <ResponseViewer response={response} isLoading={isLoading} />
        </ResizablePanes>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 開発サーバーで動作確認**

```bash
npm run dev
```

確認項目：
- 上部バーに `localhost:50051 / UserService/GetUser` 形式で表示されること
- ターゲット未設定時は `(ターゲット未設定) / ...` と表示されること
- リクエスト↔レスポンスの境界をドラッグして幅が変わること

- [ ] **Step 3: コミット**

```bash
git add src/renderer/src/components/MainPanel/GrpcPanel/index.tsx
git commit -m "feat: GrpcPanelにエンドポイント表示とリクエスト/レスポンスのリサイズを追加"
```

---

## Task 7: CollectionTree — 削除ボタン非表示・フィルタリング・マージ変更

**Files:**
- Modify: `src/renderer/src/components/Sidebar/CollectionTree.tsx`

- [ ] **Step 1: CollectionTree を更新**

`src/renderer/src/components/Sidebar/CollectionTree.tsx` に3つの変更を適用。

**変更1：`activeCaseDirs` をストアから取得し `isReflected` stateを追加**

```typescript
// インポートとストア参照の追加
const activeCaseDirs = useProjectStore((s) => s.activeCaseDirs)
// ...
const [isReflected, setIsReflected] = useState<boolean>(false)
```

**変更2：`handleReflect` を置換からマージに変更し、末尾に `setIsReflected(true)` を追加**

```typescript
const handleReflect = async (): Promise<void> => {
  const grpcTargets = (activeEnv?.protocols?.grpc as GrpcTarget[] | undefined) ?? []
  const activeTarget =
    grpcTargets.find((t) => t.id === activeProtocolTargetId) ?? grpcTargets[0]
  if (!activeTarget) return

  setIsReflecting(true)
  setReflectError(null)
  try {
    const services = await window.reqstraApi.grpcReflect(activeTarget.host, activeTarget.secure)
    const p = useProjectStore.getState().project
    if (!p) return

    const fetched: Collection[] = services.map((svc) => ({
      id: crypto.randomUUID(),
      protocol: 'grpc' as const,
      name: svc.name,
      protocolTargetId: activeTarget.id,
      endpoints: svc.methods.map((method) => ({
        id: crypto.randomUUID(),
        name: method,
        method: `${svc.name}/${method}`,
        casesDir: `requests/grpc/${svc.name}/${method}`,
      })),
    }))

    const existingNames = new Set(
      p.collections
        .filter((c) => c.protocol === 'grpc' && c.protocolTargetId === activeTarget.id)
        .map((c) => c.name),
    )
    const toAdd = fetched.filter((c) => !existingNames.has(c.name))
    useProjectStore.getState().setProject({ ...p, collections: [...p.collections, ...toAdd] })
    await persistProject()
    setIsReflected(true)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[grpc:reflect]', e)
    setReflectError(msg)
  } finally {
    setIsReflecting(false)
  }
}
```

**変更3：コレクション表示ロジックとgRPC削除ボタン非表示**

`collections` の定義の下に可視判定を追加し、JSX内の削除ボタン条件を修正：

```typescript
// collections定義の直下に追加
const isEndpointVisible = (ep: GrpcEndpoint): boolean =>
  activeProtocol !== 'grpc' || isReflected || activeCaseDirs.has(ep.casesDir)

const visibleCollections = collections.filter((col) =>
  col.endpoints.some((ep) => isEndpointVisible(ep)),
)
```

JSXの `collections.map` を `visibleCollections.map` に変更し、エンドポイントリストも可視フィルタを適用：

```tsx
{visibleCollections.map((col) => (
  <div key={col.id}>
    <div className="group flex items-center px-2 py-0.5 hover:bg-[var(--color-bg-tertiary)]">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center text-left text-[var(--color-text-secondary)]"
        onClick={() => toggleCollection(col.id)}
      >
        <span className="mr-1 shrink-0">{expandedCollections.has(col.id) ? '▾' : '▸'}</span>
        <span className="truncate font-medium">{col.name}</span>
      </button>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
        {col.protocol !== 'grpc' && (
          <button
            type="button"
            onClick={() => setModalState({ type: 'add-endpoint', collectionId: col.id })}
            title="エンドポイントを追加"
            className="rounded px-1 py-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            ＋
          </button>
        )}
        <button
          type="button"
          onClick={() => setModalState({ type: 'edit-collection', collection: col })}
          title="コレクションを編集"
          className="rounded px-1 py-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          ✎
        </button>
        {col.protocol !== 'grpc' && (
          <button
            type="button"
            onClick={() => handleCollectionDelete(col.id)}
            title="コレクションを削除"
            className="rounded px-1 py-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-error)]"
          >
            ×
          </button>
        )}
      </div>
    </div>
    {expandedCollections.has(col.id) &&
      col.endpoints
        .filter((ep) => isEndpointVisible(ep))
        .map((ep) => (
          <div key={ep.id}>
            <div className="group flex items-center py-0.5 pl-5 pr-2 hover:bg-[var(--color-bg-tertiary)]">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center text-left text-[var(--color-text-primary)]"
                onClick={() => {
                  if (!expandedEndpoints.has(ep.id)) {
                    void toggleEndpoint(ep)
                  }
                  openTab({
                    type: 'scratch',
                    id: `scratch::${ep.id}`,
                    label: ep.name,
                    endpointId: ep.id,
                  })
                }}
              >
                <span className="mr-1 shrink-0">{expandedEndpoints.has(ep.id) ? '▾' : '▸'}</span>
                <span className="truncate">{ep.name}</span>
              </button>
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() =>
                    setModalState({ type: 'edit-endpoint', collectionId: col.id, endpoint: ep })
                  }
                  title="エンドポイントを編集"
                  className="rounded px-1 py-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => handleEndpointDelete(col.id, ep.id)}
                  title="エンドポイントを削除"
                  className="rounded px-1 py-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-error)]"
                >
                  ×
                </button>
              </div>
            </div>
            {expandedEndpoints.has(ep.id) &&
              (casesByEndpoint[ep.id] ?? []).map((caseName) => (
                <div
                  key={caseName}
                  className="group flex items-center py-0.5 pl-10 pr-2 hover:bg-[var(--color-bg-tertiary)]"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-[var(--color-text-secondary)] hover:text-white"
                    onClick={() => handleCaseClick(col, ep, caseName)}
                  >
                    {caseName.replace(/\.ya?ml$/, '')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCaseDelete(ep, caseName)}
                    title="ケースを削除"
                    className="shrink-0 rounded px-1 py-0.5 opacity-0 group-hover:opacity-100 text-[var(--color-text-secondary)] hover:text-[var(--color-error)]"
                  >
                    ×
                  </button>
                </div>
              ))}
          </div>
        ))}
  </div>
))}
```

- [ ] **Step 2: 開発サーバーで動作確認**

```bash
npm run dev
```

確認項目：
- プロジェクト読み込み直後、ケースファイルがないエンドポイントは表示されないこと
- 「取得」後はすべてのエンドポイントが表示されること（再起動前まで）
- gRPCコレクションには削除（×）ボタンが表示されないこと
- 「取得」を2回実行しても同じコレクションが重複して追加されないこと

- [ ] **Step 3: コミット**

```bash
git add src/renderer/src/components/Sidebar/CollectionTree.tsx
git commit -m "feat: CollectionTreeにフィルタリング・マージ・gRPC削除ボタン非表示を実装"
```

---

## Task 8: MetadataEditor インライン編集

**Files:**
- Modify: `src/renderer/src/components/MainPanel/GrpcPanel/MetadataEditor.tsx`

- [ ] **Step 1: MetadataEditor を更新**

`src/renderer/src/components/MainPanel/GrpcPanel/MetadataEditor.tsx` を以下に変更：

```typescript
import { useState, type JSX } from 'react'

interface Props {
  metadata: Record<string, string>
  onChange: (metadata: Record<string, string>) => void
}

export function MetadataEditor({ metadata, onChange }: Props): JSX.Element {
  const [newKey, setNewKey] = useState<string>('')
  const [newValue, setNewValue] = useState<string>('')

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

  const handleKeyChange = (oldKey: string, newKey: string): void => {
    if (oldKey === newKey) return
    const next: Record<string, string> = {}
    for (const [k, v] of Object.entries(metadata)) {
      next[k === oldKey ? newKey : k] = v
    }
    onChange(next)
  }

  const handleValueChange = (key: string, value: string): void => {
    onChange({ ...metadata, [key]: value })
  }

  return (
    <div className="p-2 text-xs">
      <div className="mb-2 space-y-1">
        {Object.entries(metadata).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <input
              value={k}
              onChange={(e) => handleKeyChange(k, e.target.value)}
              className="flex-1 rounded bg-[#3c3c3c] px-2 py-0.5 text-[var(--color-text-accent)] outline-none focus:ring-1 focus:ring-[var(--color-text-accent)]"
            />
            <input
              value={v}
              onChange={(e) => handleValueChange(k, e.target.value)}
              className="flex-1 rounded bg-[#3c3c3c] px-2 py-0.5 text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-[var(--color-text-accent)]"
            />
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

- [ ] **Step 2: 開発サーバーで動作確認**

```bash
npm run dev
```

確認項目：
- Metadataタブで既存エントリのKeyとValueが直接編集できること
- Keyを変更すると古いKeyが削除されて新しいKeyで保存されること
- 編集内容がリクエスト送信時に反映されること

- [ ] **Step 3: 全テストが通ることを確認**

```bash
npm run test
```

Expected: 全テストPASS

- [ ] **Step 4: コミット**

```bash
git add src/renderer/src/components/MainPanel/GrpcPanel/MetadataEditor.tsx
git commit -m "feat: MetadataEditorの既存エントリをインライン編集可能に変更"
```
