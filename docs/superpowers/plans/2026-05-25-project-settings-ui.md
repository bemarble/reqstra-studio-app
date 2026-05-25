# プロジェクト設定UI 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** サイドバーの ✎/＋/× ボタン経由のモーダルダイアログから、環境・プロトコルターゲット・コレクション・エンドポイントを追加/編集/削除し `reqstra-project.json` へ即時保存する。

**Architecture:** 既存の `saveProject` IPC を再利用。`projectStore` に 8 つの新アクションを追加し、4 つのモーダルコンポーネントを新規作成する。ユーザー操作 → モーダル submit → `projectStore` 更新 → `window.reqstraApi.saveProject(project)` の流れで保存する。

**Tech Stack:** React 18, TypeScript, Zustand, TailwindCSS v4, vitest + @testing-library/react

---

## File Structure

**新規作成:**
- `src/renderer/src/components/modals/EnvironmentModal.tsx` — 環境 追加/編集 モーダル
- `src/renderer/src/components/modals/ProtocolTargetModal.tsx` — プロトコルターゲット 追加/編集 モーダル
- `src/renderer/src/components/modals/CollectionModal.tsx` — コレクション 追加/編集 モーダル
- `src/renderer/src/components/modals/EndpointModal.tsx` — エンドポイント 追加/編集 モーダル
- `tests/renderer/store/projectStore.test.ts` — projectStore 新アクションのテスト
- `tests/renderer/components/modals/EnvironmentModal.test.tsx` — モーダルテスト
- `tests/renderer/components/modals/ProtocolTargetModal.test.tsx` — モーダルテスト
- `tests/renderer/components/modals/CollectionModal.test.tsx` — モーダルテスト
- `tests/renderer/components/modals/EndpointModal.test.tsx` — モーダルテスト

**変更:**
- `src/renderer/src/store/projectStore.ts` — 8 つの新アクションを追加
- `src/renderer/src/components/Sidebar/EnvironmentSelector.tsx` — ✎/＋ ボタン + モーダル統合
- `src/renderer/src/components/Sidebar/ProtocolTargetSelector.tsx` — ✎/＋ ボタン + モーダル統合
- `src/renderer/src/components/Sidebar/CollectionTree.tsx` — ＋/✎/× ボタン + モーダル統合

---

### Task 1: projectStore — 8 つの新アクション

**Files:**
- Modify: `src/renderer/src/store/projectStore.ts`
- Create: `tests/renderer/store/projectStore.test.ts`

- [ ] **Step 1: テストファイルを作成する（失敗することを確認）**

```typescript
// tests/renderer/store/projectStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useProjectStore } from '../../../src/renderer/src/store/projectStore'
import type { ReqstraProject, GrpcTarget, GrpcEndpoint } from '../../../src/shared/types/project'

const createMockProject = (): ReqstraProject => ({
  name: 'test',
  projectDir: '/tmp/test',
  environments: [
    {
      id: 'env-1',
      name: 'dev',
      protocols: {
        grpc: [{ id: 'grpc-1', name: 'Local', host: 'localhost:50051', secure: false }],
      },
    },
  ],
  collections: [
    {
      id: 'col-1',
      protocol: 'grpc',
      name: 'UserService',
      protocolTargetId: 'grpc-1',
      endpoints: [
        {
          id: 'ep-1',
          name: 'GetUser',
          method: 'UserService/GetUser',
          casesDir: 'requests/grpc/UserService/GetUser',
        },
      ],
    },
  ],
})

describe('useProjectStore — 新アクション', () => {
  beforeEach(() => {
    useProjectStore.setState({ project: createMockProject() })
  })

  describe('deleteEnvironment', () => {
    it('指定IDの環境を削除する', () => {
      const { result } = renderHook(() => useProjectStore())
      act(() => result.current.deleteEnvironment('env-1'))
      expect(result.current.project?.environments).toHaveLength(0)
    })

    it('projectがnullの時は何もしない', () => {
      useProjectStore.setState({ project: null })
      const { result } = renderHook(() => useProjectStore())
      act(() => result.current.deleteEnvironment('env-1'))
      expect(result.current.project).toBeNull()
    })
  })

  describe('addProtocolTarget', () => {
    it('指定環境にgRPCターゲットを追加する', () => {
      const { result } = renderHook(() => useProjectStore())
      const newTarget: GrpcTarget = { id: 'grpc-2', name: 'Staging', host: 'staging:50051', secure: true }
      act(() => result.current.addProtocolTarget('env-1', 'grpc', newTarget))
      expect(result.current.project?.environments[0].protocols.grpc).toHaveLength(2)
      expect(result.current.project?.environments[0].protocols.grpc?.[1].id).toBe('grpc-2')
    })

    it('httpプロトコルが未定義の環境にターゲットを追加する', () => {
      const { result } = renderHook(() => useProjectStore())
      const newTarget = { id: 'http-1', name: 'REST', baseUrl: 'http://localhost:3000' }
      act(() => result.current.addProtocolTarget('env-1', 'http', newTarget))
      expect(result.current.project?.environments[0].protocols.http).toHaveLength(1)
    })
  })

  describe('updateProtocolTarget', () => {
    it('指定環境のgRPCターゲットを更新する', () => {
      const { result } = renderHook(() => useProjectStore())
      const updated: GrpcTarget = { id: 'grpc-1', name: 'Updated', host: 'new-host:50051', secure: true }
      act(() => result.current.updateProtocolTarget('env-1', 'grpc', updated))
      expect(result.current.project?.environments[0].protocols.grpc?.[0].name).toBe('Updated')
      expect(result.current.project?.environments[0].protocols.grpc?.[0].host).toBe('new-host:50051')
    })
  })

  describe('deleteProtocolTarget', () => {
    it('指定環境のgRPCターゲットを削除する', () => {
      const { result } = renderHook(() => useProjectStore())
      act(() => result.current.deleteProtocolTarget('env-1', 'grpc', 'grpc-1'))
      expect(result.current.project?.environments[0].protocols.grpc).toHaveLength(0)
    })
  })

  describe('deleteCollection', () => {
    it('指定IDのコレクションを削除する', () => {
      const { result } = renderHook(() => useProjectStore())
      act(() => result.current.deleteCollection('col-1'))
      expect(result.current.project?.collections).toHaveLength(0)
    })

    it('projectがnullの時は何もしない', () => {
      useProjectStore.setState({ project: null })
      const { result } = renderHook(() => useProjectStore())
      act(() => result.current.deleteCollection('col-1'))
      expect(result.current.project).toBeNull()
    })
  })

  describe('addEndpoint', () => {
    it('指定コレクションにエンドポイントを追加する', () => {
      const { result } = renderHook(() => useProjectStore())
      const ep: GrpcEndpoint = {
        id: 'ep-2',
        name: 'ListUsers',
        method: 'UserService/ListUsers',
        casesDir: 'requests/grpc/UserService/ListUsers',
      }
      act(() => result.current.addEndpoint('col-1', ep))
      expect(result.current.project?.collections[0].endpoints).toHaveLength(2)
      expect(result.current.project?.collections[0].endpoints[1].id).toBe('ep-2')
    })
  })

  describe('updateEndpoint', () => {
    it('指定コレクションのエンドポイントを更新する', () => {
      const { result } = renderHook(() => useProjectStore())
      const updated: GrpcEndpoint = {
        id: 'ep-1',
        name: 'GetUserV2',
        method: 'UserService/GetUserV2',
        casesDir: 'requests/grpc/UserService/GetUserV2',
      }
      act(() => result.current.updateEndpoint('col-1', updated))
      expect(result.current.project?.collections[0].endpoints[0].name).toBe('GetUserV2')
      expect(result.current.project?.collections[0].endpoints[0].method).toBe('UserService/GetUserV2')
    })
  })

  describe('deleteEndpoint', () => {
    it('指定コレクションのエンドポイントを削除する', () => {
      const { result } = renderHook(() => useProjectStore())
      act(() => result.current.deleteEndpoint('col-1', 'ep-1'))
      expect(result.current.project?.collections[0].endpoints).toHaveLength(0)
    })
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npm run test -- --project renderer tests/renderer/store/projectStore.test.ts
```

Expected: FAIL（`deleteEnvironment` 等が存在しない）

- [ ] **Step 3: projectStore に新アクションを実装する**

`src/renderer/src/store/projectStore.ts` を以下の完全な内容に差し替える:

```typescript
import { create } from 'zustand'
import type {
  ReqstraProject,
  Collection,
  Environment,
  GrpcTarget,
  HttpTarget,
  GraphQLTarget,
  GrpcEndpoint,
} from '../../../shared/types/project'

interface ProjectState {
  project: ReqstraProject | null
  setProject: (project: ReqstraProject) => void
  updateCollection: (collection: Collection) => void
  addCollection: (collection: Collection) => void
  updateEnvironment: (env: Environment) => void
  addEnvironment: (env: Environment) => void
  deleteEnvironment: (id: string) => void
  addProtocolTarget: (
    envId: string,
    protocol: 'grpc' | 'http' | 'graphql',
    target: GrpcTarget | HttpTarget | GraphQLTarget,
  ) => void
  updateProtocolTarget: (
    envId: string,
    protocol: 'grpc' | 'http' | 'graphql',
    target: GrpcTarget | HttpTarget | GraphQLTarget,
  ) => void
  deleteProtocolTarget: (envId: string, protocol: 'grpc' | 'http' | 'graphql', targetId: string) => void
  deleteCollection: (id: string) => void
  addEndpoint: (collectionId: string, endpoint: GrpcEndpoint) => void
  updateEndpoint: (collectionId: string, endpoint: GrpcEndpoint) => void
  deleteEndpoint: (collectionId: string, endpointId: string) => void
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
          collections: state.project.collections.map((c) => (c.id === collection.id ? collection : c)),
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
          environments: state.project.environments.map((e) => (e.id === env.id ? env : e)),
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
  deleteEnvironment: (id) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          environments: state.project.environments.filter((e) => e.id !== id),
        },
      }
    }),
  addProtocolTarget: (envId, protocol, target) =>
    set((state) => {
      if (!state.project) return state
      const environments = state.project.environments.map((env) => {
        if (env.id !== envId) return env
        const current = (env.protocols[protocol] ?? []) as (GrpcTarget | HttpTarget | GraphQLTarget)[]
        return { ...env, protocols: { ...env.protocols, [protocol]: [...current, target] } }
      })
      return { project: { ...state.project, environments } }
    }),
  updateProtocolTarget: (envId, protocol, target) =>
    set((state) => {
      if (!state.project) return state
      const environments = state.project.environments.map((env) => {
        if (env.id !== envId) return env
        const current = (env.protocols[protocol] ?? []) as (GrpcTarget | HttpTarget | GraphQLTarget)[]
        return {
          ...env,
          protocols: {
            ...env.protocols,
            [protocol]: current.map((t) => (t.id === target.id ? target : t)),
          },
        }
      })
      return { project: { ...state.project, environments } }
    }),
  deleteProtocolTarget: (envId, protocol, targetId) =>
    set((state) => {
      if (!state.project) return state
      const environments = state.project.environments.map((env) => {
        if (env.id !== envId) return env
        const current = (env.protocols[protocol] ?? []) as (GrpcTarget | HttpTarget | GraphQLTarget)[]
        return {
          ...env,
          protocols: {
            ...env.protocols,
            [protocol]: current.filter((t) => t.id !== targetId),
          },
        }
      })
      return { project: { ...state.project, environments } }
    }),
  deleteCollection: (id) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          collections: state.project.collections.filter((c) => c.id !== id),
        },
      }
    }),
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
  deleteEndpoint: (collectionId, endpointId) =>
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          collections: state.project.collections.map((c) =>
            c.id === collectionId
              ? { ...c, endpoints: c.endpoints.filter((ep) => ep.id !== endpointId) }
              : c,
          ),
        },
      }
    }),
}))
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npm run test -- --project renderer tests/renderer/store/projectStore.test.ts
```

Expected: PASS（全テスト）

- [ ] **Step 5: コミットする**

```bash
git add src/renderer/src/store/projectStore.ts tests/renderer/store/projectStore.test.ts
git commit -m "feat: projectStoreに環境・ターゲット・コレクション・エンドポイントの削除/追加/更新アクションを追加"
```

---

### Task 2: EnvironmentModal コンポーネント

**Files:**
- Create: `src/renderer/src/components/modals/EnvironmentModal.tsx`
- Create: `tests/renderer/components/modals/EnvironmentModal.test.tsx`

- [ ] **Step 1: テストファイルを作成する（失敗することを確認）**

```typescript
// tests/renderer/components/modals/EnvironmentModal.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { EnvironmentModal } from '../../../../src/renderer/src/components/modals/EnvironmentModal'

describe('EnvironmentModal', () => {
  it('名前が空の時は追加ボタンが無効', () => {
    render(<EnvironmentModal mode="add" onSubmit={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: '追加' })).toBeDisabled()
  })

  it('名前を入力して追加するとonSubmitが呼ばれる', () => {
    const onSubmit = vi.fn()
    render(<EnvironmentModal mode="add" onSubmit={onSubmit} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('例: dev'), { target: { value: 'staging' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'staging', protocols: {} }))
  })

  it('editモードでは既存の名前が初期表示される', () => {
    const env = { id: 'env-1', name: 'dev', protocols: {} }
    render(<EnvironmentModal mode="edit" initial={env} onSubmit={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByDisplayValue('dev')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
  })

  it('editモードの削除ボタンをクリックすると確認後にonDeleteが呼ばれる', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onDelete = vi.fn()
    const env = { id: 'env-1', name: 'dev', protocols: {} }
    render(<EnvironmentModal mode="edit" initial={env} onSubmit={vi.fn()} onDelete={onDelete} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '削除' }))
    expect(window.confirm).toHaveBeenCalled()
    expect(onDelete).toHaveBeenCalled()
  })

  it('削除確認でキャンセルするとonDeleteは呼ばれない', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const onDelete = vi.fn()
    const env = { id: 'env-1', name: 'dev', protocols: {} }
    render(<EnvironmentModal mode="edit" initial={env} onSubmit={vi.fn()} onDelete={onDelete} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '削除' }))
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('キャンセルボタンでonCloseが呼ばれる', () => {
    const onClose = vi.fn()
    render(<EnvironmentModal mode="add" onSubmit={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('deleteWarningがある場合は確認メッセージに警告が含まれる', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const env = { id: 'env-1', name: 'dev', protocols: {} }
    render(
      <EnvironmentModal
        mode="edit"
        initial={env}
        onSubmit={vi.fn()}
        onDelete={vi.fn()}
        deleteWarning="以下のコレクションがこの環境のターゲットを参照しています: UserService"
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '削除' }))
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('UserService'),
    )
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npm run test -- --project renderer tests/renderer/components/modals/EnvironmentModal.test.tsx
```

Expected: FAIL（モジュールが存在しない）

- [ ] **Step 3: EnvironmentModal を実装する**

```typescript
// src/renderer/src/components/modals/EnvironmentModal.tsx
import { useState, type JSX } from 'react'
import type { Environment } from '../../../../shared/types/project'

interface Props {
  mode: 'add' | 'edit'
  initial?: Environment
  onSubmit: (env: Environment) => void
  onDelete?: () => void
  onClose: () => void
  deleteWarning?: string
}

export function EnvironmentModal({ mode, initial, onSubmit, onDelete, onClose, deleteWarning }: Props): JSX.Element {
  const [name, setName] = useState<string>(initial?.name ?? '')

  const isValid = name.trim().length > 0

  const handleSubmit = (): void => {
    if (!isValid) return
    onSubmit({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      protocols: initial?.protocols ?? {},
    })
  }

  const handleDelete = (): void => {
    const message = deleteWarning
      ? `環境「${name}」を削除しますか？\n\n${deleteWarning}`
      : `環境「${name}」を削除しますか？`
    if (window.confirm(message)) {
      onDelete?.()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-80 rounded bg-[var(--color-bg-secondary)] p-4 shadow-xl">
        <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
          {mode === 'add' ? '環境を追加' : '環境を編集'}
        </h2>

        <div className="mb-4">
          <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">名前</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: dev"
            autoFocus
            className="w-full rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-accent)]"
          />
        </div>

        {mode === 'edit' && onDelete && (
          <div className="mb-4">
            <button
              type="button"
              onClick={handleDelete}
              className="text-xs text-[var(--color-error)] hover:underline"
            >
              削除
            </button>
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
            disabled={!isValid}
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

- [ ] **Step 4: テストが通ることを確認する**

```bash
npm run test -- --project renderer tests/renderer/components/modals/EnvironmentModal.test.tsx
```

Expected: PASS（全テスト）

- [ ] **Step 5: コミットする**

```bash
git add src/renderer/src/components/modals/EnvironmentModal.tsx tests/renderer/components/modals/EnvironmentModal.test.tsx
git commit -m "feat: EnvironmentModalコンポーネントを追加"
```

---

### Task 3: ProtocolTargetModal コンポーネント

**Files:**
- Create: `src/renderer/src/components/modals/ProtocolTargetModal.tsx`
- Create: `tests/renderer/components/modals/ProtocolTargetModal.test.tsx`

- [ ] **Step 1: テストファイルを作成する（失敗することを確認）**

```typescript
// tests/renderer/components/modals/ProtocolTargetModal.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { ProtocolTargetModal } from '../../../../src/renderer/src/components/modals/ProtocolTargetModal'

describe('ProtocolTargetModal — grpc', () => {
  it('名前/ホストが空の時は追加ボタンが無効', () => {
    render(<ProtocolTargetModal mode="add" protocol="grpc" onSubmit={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: '追加' })).toBeDisabled()
  })

  it('gRPCターゲットを追加するとonSubmitが呼ばれる', () => {
    const onSubmit = vi.fn()
    render(<ProtocolTargetModal mode="add" protocol="grpc" onSubmit={onSubmit} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('例: Local gRPC'), { target: { value: 'Local' } })
    fireEvent.change(screen.getByPlaceholderText('例: localhost:50051'), { target: { value: 'localhost:50051' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Local', host: 'localhost:50051', secure: false }),
    )
  })

  it('TLSチェックボックスを切り替えると secure が変わる', () => {
    const onSubmit = vi.fn()
    render(<ProtocolTargetModal mode="add" protocol="grpc" onSubmit={onSubmit} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('例: Local gRPC'), { target: { value: 'Local' } })
    fireEvent.change(screen.getByPlaceholderText('例: localhost:50051'), { target: { value: 'localhost:50051' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ secure: true }))
  })

  it('editモードでは既存の値が初期表示される', () => {
    const target = { id: 'grpc-1', name: 'Local', host: 'localhost:50051', secure: false }
    render(
      <ProtocolTargetModal mode="edit" protocol="grpc" initial={target} onSubmit={vi.fn()} onClose={vi.fn()} />,
    )
    expect(screen.getByDisplayValue('Local')).toBeInTheDocument()
    expect(screen.getByDisplayValue('localhost:50051')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
  })

  it('削除ボタンをクリックすると確認後にonDeleteが呼ばれる', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onDelete = vi.fn()
    const target = { id: 'grpc-1', name: 'Local', host: 'localhost:50051', secure: false }
    render(
      <ProtocolTargetModal
        mode="edit"
        protocol="grpc"
        initial={target}
        onSubmit={vi.fn()}
        onDelete={onDelete}
        onClose={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: '削除' }))
    expect(onDelete).toHaveBeenCalled()
  })
})

describe('ProtocolTargetModal — http', () => {
  it('HTTPターゲットを追加するとonSubmitに baseUrl が含まれる', () => {
    const onSubmit = vi.fn()
    render(<ProtocolTargetModal mode="add" protocol="http" onSubmit={onSubmit} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('例: REST API'), { target: { value: 'REST API' } })
    fireEvent.change(screen.getByPlaceholderText('例: http://localhost:3000'), {
      target: { value: 'http://localhost:3000' },
    })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'REST API', baseUrl: 'http://localhost:3000' }),
    )
  })
})

describe('ProtocolTargetModal — graphql', () => {
  it('GraphQLターゲットを追加するとonSubmitに host が含まれる', () => {
    const onSubmit = vi.fn()
    render(<ProtocolTargetModal mode="add" protocol="graphql" onSubmit={onSubmit} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('例: GraphQL API'), { target: { value: 'GraphQL' } })
    fireEvent.change(screen.getByPlaceholderText('例: http://localhost:4000/graphql'), {
      target: { value: 'http://localhost:4000/graphql' },
    })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'GraphQL', host: 'http://localhost:4000/graphql' }),
    )
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npm run test -- --project renderer tests/renderer/components/modals/ProtocolTargetModal.test.tsx
```

Expected: FAIL

- [ ] **Step 3: ProtocolTargetModal を実装する**

```typescript
// src/renderer/src/components/modals/ProtocolTargetModal.tsx
import { useState, type JSX } from 'react'
import type { GrpcTarget, HttpTarget, GraphQLTarget } from '../../../../shared/types/project'

interface Props {
  mode: 'add' | 'edit'
  protocol: 'grpc' | 'http' | 'graphql'
  initial?: GrpcTarget | HttpTarget | GraphQLTarget
  onSubmit: (target: GrpcTarget | HttpTarget | GraphQLTarget) => void
  onDelete?: () => void
  onClose: () => void
}

const TITLES = {
  grpc: { add: 'gRPCターゲットを追加', edit: 'gRPCターゲットを編集' },
  http: { add: 'HTTPターゲットを追加', edit: 'HTTPターゲットを編集' },
  graphql: { add: 'GraphQLターゲットを追加', edit: 'GraphQLターゲットを編集' },
}

export function ProtocolTargetModal({ mode, protocol, initial, onSubmit, onDelete, onClose }: Props): JSX.Element {
  const [name, setName] = useState<string>(initial?.name ?? '')
  const [host, setHost] = useState<string>(() => {
    if (protocol === 'grpc') return (initial as GrpcTarget | undefined)?.host ?? ''
    if (protocol === 'graphql') return (initial as GraphQLTarget | undefined)?.host ?? ''
    return ''
  })
  const [baseUrl, setBaseUrl] = useState<string>(() => {
    if (protocol === 'http') return (initial as HttpTarget | undefined)?.baseUrl ?? ''
    return ''
  })
  const [secure, setSecure] = useState<boolean>(() => {
    if (protocol === 'grpc') return (initial as GrpcTarget | undefined)?.secure ?? false
    return false
  })

  const isValid =
    name.trim().length > 0 &&
    (protocol === 'http' ? baseUrl.trim().length > 0 : host.trim().length > 0)

  const handleSubmit = (): void => {
    if (!isValid) return
    const id = initial?.id ?? crypto.randomUUID()
    if (protocol === 'grpc') {
      onSubmit({ id, name: name.trim(), host: host.trim(), secure } satisfies GrpcTarget)
    } else if (protocol === 'http') {
      onSubmit({ id, name: name.trim(), baseUrl: baseUrl.trim() } satisfies HttpTarget)
    } else {
      onSubmit({ id, name: name.trim(), host: host.trim() } satisfies GraphQLTarget)
    }
  }

  const handleDelete = (): void => {
    if (window.confirm(`ターゲット「${name}」を削除しますか？`)) {
      onDelete?.()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-80 rounded bg-[var(--color-bg-secondary)] p-4 shadow-xl">
        <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
          {TITLES[protocol][mode]}
        </h2>

        <div className="mb-3">
          <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">名前</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={protocol === 'grpc' ? '例: Local gRPC' : protocol === 'http' ? '例: REST API' : '例: GraphQL API'}
            autoFocus
            className="w-full rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-accent)]"
          />
        </div>

        {protocol !== 'http' && (
          <div className="mb-3">
            <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">ホスト</label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder={protocol === 'grpc' ? '例: localhost:50051' : '例: http://localhost:4000/graphql'}
              className="w-full rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-accent)]"
            />
          </div>
        )}

        {protocol === 'http' && (
          <div className="mb-3">
            <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">Base URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="例: http://localhost:3000"
              className="w-full rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-accent)]"
            />
          </div>
        )}

        {protocol === 'grpc' && (
          <div className="mb-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="tls-secure"
              checked={secure}
              onChange={(e) => setSecure(e.target.checked)}
              className="cursor-pointer"
            />
            <label htmlFor="tls-secure" className="cursor-pointer text-xs text-[var(--color-text-primary)]">
              TLS (secure)
            </label>
          </div>
        )}

        {mode === 'edit' && onDelete && (
          <div className="mb-4">
            <button
              type="button"
              onClick={handleDelete}
              className="text-xs text-[var(--color-error)] hover:underline"
            >
              削除
            </button>
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
            disabled={!isValid}
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

- [ ] **Step 4: テストが通ることを確認する**

```bash
npm run test -- --project renderer tests/renderer/components/modals/ProtocolTargetModal.test.tsx
```

Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/renderer/src/components/modals/ProtocolTargetModal.tsx tests/renderer/components/modals/ProtocolTargetModal.test.tsx
git commit -m "feat: ProtocolTargetModalコンポーネントを追加"
```

---

### Task 4: CollectionModal コンポーネント

**Files:**
- Create: `src/renderer/src/components/modals/CollectionModal.tsx`
- Create: `tests/renderer/components/modals/CollectionModal.test.tsx`

- [ ] **Step 1: テストファイルを作成する（失敗することを確認）**

```typescript
// tests/renderer/components/modals/CollectionModal.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { CollectionModal } from '../../../../src/renderer/src/components/modals/CollectionModal'
import type { Environment } from '../../../../src/shared/types/project'

const mockEnv: Environment = {
  id: 'env-1',
  name: 'dev',
  protocols: {
    grpc: [{ id: 'grpc-1', name: 'Local gRPC', host: 'localhost:50051', secure: false }],
    http: [{ id: 'http-1', name: 'REST API', baseUrl: 'http://localhost:3000' }],
  },
}

describe('CollectionModal', () => {
  it('名前が空の時は追加ボタンが無効', () => {
    render(<CollectionModal mode="add" environment={mockEnv} onSubmit={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: '追加' })).toBeDisabled()
  })

  it('名前を入力して追加するとonSubmitが呼ばれる', () => {
    const onSubmit = vi.fn()
    render(<CollectionModal mode="add" environment={mockEnv} onSubmit={onSubmit} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('例: UserService'), { target: { value: 'UserService' } })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'UserService', protocol: 'grpc', endpoints: [] }),
    )
  })

  it('editモードではプロトコルが変更不可', () => {
    const collection = {
      id: 'col-1',
      protocol: 'grpc' as const,
      name: 'UserService',
      protocolTargetId: 'grpc-1',
      endpoints: [],
    }
    render(<CollectionModal mode="edit" initial={collection} environment={mockEnv} onSubmit={vi.fn()} onClose={vi.fn()} />)
    const protocolSelect = screen.getByDisplayValue('gRPC')
    expect(protocolSelect).toBeDisabled()
  })

  it('editモードでは既存の値が初期表示される', () => {
    const collection = {
      id: 'col-1',
      protocol: 'grpc' as const,
      name: 'UserService',
      protocolTargetId: 'grpc-1',
      endpoints: [],
    }
    render(<CollectionModal mode="edit" initial={collection} environment={mockEnv} onSubmit={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByDisplayValue('UserService')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npm run test -- --project renderer tests/renderer/components/modals/CollectionModal.test.tsx
```

Expected: FAIL

- [ ] **Step 3: CollectionModal を実装する**

```typescript
// src/renderer/src/components/modals/CollectionModal.tsx
import { useState, type JSX } from 'react'
import type { Collection, Environment } from '../../../../shared/types/project'

interface Props {
  mode: 'add' | 'edit'
  initial?: Collection
  environment: Environment | undefined
  onSubmit: (col: Collection) => void
  onClose: () => void
}

const PROTOCOL_LABELS = { grpc: 'gRPC', http: 'HTTP', graphql: 'GraphQL' }

export function CollectionModal({ mode, initial, environment, onSubmit, onClose }: Props): JSX.Element {
  const [name, setName] = useState<string>(initial?.name ?? '')
  const [protocol, setProtocol] = useState<'grpc' | 'http' | 'graphql'>(initial?.protocol ?? 'grpc')
  const availableTargets =
    (environment?.protocols[protocol] as Array<{ id: string; name: string }> | undefined) ?? []
  const [protocolTargetId, setProtocolTargetId] = useState<string>(
    initial?.protocolTargetId ?? availableTargets[0]?.id ?? '',
  )

  const handleProtocolChange = (next: 'grpc' | 'http' | 'graphql'): void => {
    setProtocol(next)
    const targets =
      (environment?.protocols[next] as Array<{ id: string; name: string }> | undefined) ?? []
    setProtocolTargetId(targets[0]?.id ?? '')
  }

  const currentTargets =
    (environment?.protocols[protocol] as Array<{ id: string; name: string }> | undefined) ?? []

  const isValid = name.trim().length > 0

  const handleSubmit = (): void => {
    if (!isValid) return
    onSubmit({
      id: initial?.id ?? crypto.randomUUID(),
      protocol,
      name: name.trim(),
      protocolTargetId,
      endpoints: initial?.endpoints ?? [],
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-80 rounded bg-[var(--color-bg-secondary)] p-4 shadow-xl">
        <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
          {mode === 'add' ? 'コレクションを追加' : 'コレクションを編集'}
        </h2>

        <div className="mb-3">
          <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">名前</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: UserService"
            autoFocus
            className="w-full rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-accent)]"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">プロトコル</label>
          <select
            value={protocol}
            onChange={(e) => handleProtocolChange(e.target.value as 'grpc' | 'http' | 'graphql')}
            disabled={mode === 'edit'}
            className="w-full rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none disabled:opacity-60"
          >
            {(['grpc', 'http', 'graphql'] as const).map((p) => (
              <option key={p} value={p}>
                {PROTOCOL_LABELS[p]}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">ターゲット</label>
          <select
            value={protocolTargetId}
            onChange={(e) => setProtocolTargetId(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none"
          >
            {currentTargets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            {currentTargets.length === 0 && <option value="">ターゲット未設定</option>}
          </select>
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
            disabled={!isValid}
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

- [ ] **Step 4: テストが通ることを確認する**

```bash
npm run test -- --project renderer tests/renderer/components/modals/CollectionModal.test.tsx
```

Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/renderer/src/components/modals/CollectionModal.tsx tests/renderer/components/modals/CollectionModal.test.tsx
git commit -m "feat: CollectionModalコンポーネントを追加"
```

---

### Task 5: EndpointModal コンポーネント

**Files:**
- Create: `src/renderer/src/components/modals/EndpointModal.tsx`
- Create: `tests/renderer/components/modals/EndpointModal.test.tsx`

- [ ] **Step 1: テストファイルを作成する（失敗することを確認）**

```typescript
// tests/renderer/components/modals/EndpointModal.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { EndpointModal } from '../../../../src/renderer/src/components/modals/EndpointModal'

describe('EndpointModal', () => {
  it('名前/メソッドが空の時は追加ボタンが無効', () => {
    render(<EndpointModal mode="add" protocol="grpc" onSubmit={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: '追加' })).toBeDisabled()
  })

  it('名前とメソッドを入力して追加するとonSubmitが呼ばれる', () => {
    const onSubmit = vi.fn()
    render(<EndpointModal mode="add" protocol="grpc" onSubmit={onSubmit} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('例: GetUser'), { target: { value: 'GetUser' } })
    fireEvent.change(screen.getByPlaceholderText('例: UserService/GetUser'), {
      target: { value: 'UserService/GetUser' },
    })
    fireEvent.click(screen.getByRole('button', { name: '追加' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'GetUser',
        method: 'UserService/GetUser',
        casesDir: 'requests/grpc/UserService/GetUser',
      }),
    )
  })

  it('メソッドを入力するとcasesDirが自動表示される', () => {
    render(<EndpointModal mode="add" protocol="grpc" onSubmit={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('例: UserService/GetUser'), {
      target: { value: 'UserService/GetUser' },
    })
    expect(screen.getByText('requests/grpc/UserService/GetUser')).toBeInTheDocument()
  })

  it('editモードでは既存の値が初期表示される', () => {
    const ep = {
      id: 'ep-1',
      name: 'GetUser',
      method: 'UserService/GetUser',
      casesDir: 'requests/grpc/UserService/GetUser',
    }
    render(<EndpointModal mode="edit" protocol="grpc" initial={ep} onSubmit={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByDisplayValue('GetUser')).toBeInTheDocument()
    expect(screen.getByDisplayValue('UserService/GetUser')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npm run test -- --project renderer tests/renderer/components/modals/EndpointModal.test.tsx
```

Expected: FAIL

- [ ] **Step 3: EndpointModal を実装する**

```typescript
// src/renderer/src/components/modals/EndpointModal.tsx
import { useState, useMemo, type JSX } from 'react'
import type { GrpcEndpoint } from '../../../../shared/types/project'

interface Props {
  mode: 'add' | 'edit'
  protocol: 'grpc' | 'http' | 'graphql'
  initial?: GrpcEndpoint
  onSubmit: (ep: GrpcEndpoint) => void
  onClose: () => void
}

export function EndpointModal({ mode, protocol, initial, onSubmit, onClose }: Props): JSX.Element {
  const [name, setName] = useState<string>(initial?.name ?? '')
  const [method, setMethod] = useState<string>(initial?.method ?? '')

  const casesDir = useMemo<string>(() => {
    if (!method.trim()) return ''
    return `requests/${protocol}/${method.trim()}`
  }, [method, protocol])

  const isValid = name.trim().length > 0 && method.trim().length > 0

  const handleSubmit = (): void => {
    if (!isValid) return
    onSubmit({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      method: method.trim(),
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
          <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">名前</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: GetUser"
            autoFocus
            className="w-full rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-accent)]"
          />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">メソッド</label>
          <input
            type="text"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            placeholder="例: UserService/GetUser"
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
            disabled={!isValid}
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

- [ ] **Step 4: テストが通ることを確認する**

```bash
npm run test -- --project renderer tests/renderer/components/modals/EndpointModal.test.tsx
```

Expected: PASS

- [ ] **Step 5: コミットする**

```bash
git add src/renderer/src/components/modals/EndpointModal.tsx tests/renderer/components/modals/EndpointModal.test.tsx
git commit -m "feat: EndpointModalコンポーネントを追加"
```

---

### Task 6: EnvironmentSelector — ✎/＋ ボタン + モーダル統合

**Files:**
- Modify: `src/renderer/src/components/Sidebar/EnvironmentSelector.tsx`

- [ ] **Step 1: EnvironmentSelector を改修する**

`src/renderer/src/components/Sidebar/EnvironmentSelector.tsx` の内容を以下に差し替える:

```typescript
import { useState, type JSX } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useAppStore } from '../../store/appStore'
import type { Environment } from '../../../../shared/types/project'
import { EnvironmentModal } from '../modals/EnvironmentModal'

type ModalState = { type: 'add' } | { type: 'edit'; env: Environment } | null

export function EnvironmentSelector(): JSX.Element {
  const environments = useProjectStore((s) => s.project?.environments ?? [])
  const addEnvironment = useProjectStore((s) => s.addEnvironment)
  const updateEnvironment = useProjectStore((s) => s.updateEnvironment)
  const deleteEnvironment = useProjectStore((s) => s.deleteEnvironment)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const setActiveEnvironmentId = useAppStore((s) => s.setActiveEnvironmentId)

  const [modal, setModal] = useState<ModalState>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const active = environments.find((e) => e.id === activeEnvironmentId) ?? environments[0]

  const getDeleteWarning = (envId: string): string | undefined => {
    const p = useProjectStore.getState().project
    if (!p) return undefined
    const env = p.environments.find((e) => e.id === envId)
    if (!env) return undefined
    const targetIds = new Set<string>(
      Object.values(env.protocols).flatMap(
        (targets) => (targets as Array<{ id: string }> | undefined)?.map((t) => t.id) ?? [],
      ),
    )
    const affected = p.collections.filter((c) => targetIds.has(c.protocolTargetId))
    if (affected.length === 0) return undefined
    return `以下のコレクションがこの環境のターゲットを参照しています: ${affected.map((c) => c.name).join('、')}`
  }

  const persistProject = async (): Promise<boolean> => {
    const project = useProjectStore.getState().project
    if (!project) return false
    try {
      await window.reqstraApi.saveProject(project)
      setSaveError(null)
      return true
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
      return false
    }
  }

  const handleSubmit = async (env: Environment): Promise<void> => {
    if (modal?.type === 'add') {
      addEnvironment(env)
      setActiveEnvironmentId(env.id)
    } else {
      updateEnvironment(env)
    }
    if (await persistProject()) setModal(null)
  }

  const handleDelete = async (id: string): Promise<void> => {
    deleteEnvironment(id)
    if (activeEnvironmentId === id) {
      const remaining = useProjectStore.getState().project?.environments ?? []
      setActiveEnvironmentId(remaining[0]?.id ?? null)
    }
    if (await persistProject()) setModal(null)
  }

  return (
    <div className="border-b border-[var(--color-border)] px-2 py-1">
      <div className="flex items-center gap-1">
        <select
          value={active?.id ?? ''}
          onChange={(e) => setActiveEnvironmentId(e.target.value)}
          className="min-w-0 flex-1 rounded bg-[#3c3c3c] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none"
        >
          {environments.map((env) => (
            <option key={env.id} value={env.id}>
              🌍 {env.name}
            </option>
          ))}
          {environments.length === 0 && <option value="">環境未設定</option>}
        </select>
        {active && (
          <button
            type="button"
            onClick={() => setModal({ type: 'edit', env: active })}
            title="環境を編集"
            className="shrink-0 rounded bg-[#3c3c3c] px-1.5 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            ✎
          </button>
        )}
        <button
          type="button"
          onClick={() => setModal({ type: 'add' })}
          title="環境を追加"
          className="shrink-0 rounded bg-[var(--color-bg-active)] px-1.5 py-1 text-xs text-white"
        >
          ＋
        </button>
      </div>
      {saveError && <p className="mt-1 text-xs text-[var(--color-error)]">{saveError}</p>}
      {modal && (
        <EnvironmentModal
          mode={modal.type}
          initial={modal.type === 'edit' ? modal.env : undefined}
          onSubmit={handleSubmit}
          onDelete={modal.type === 'edit' ? () => handleDelete(modal.env.id) : undefined}
          deleteWarning={modal.type === 'edit' ? getDeleteWarning(modal.env.id) : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: 全テストが通ることを確認する**

```bash
npm run test -- --project renderer
```

Expected: PASS（既存テストを含む全テスト）

- [ ] **Step 3: コミットする**

```bash
git add src/renderer/src/components/Sidebar/EnvironmentSelector.tsx
git commit -m "feat: EnvironmentSelectorに環境追加/編集ボタンを追加"
```

---

### Task 7: ProtocolTargetSelector — ✎/＋ ボタン + モーダル統合

**Files:**
- Modify: `src/renderer/src/components/Sidebar/ProtocolTargetSelector.tsx`

- [ ] **Step 1: ProtocolTargetSelector を改修する**

`src/renderer/src/components/Sidebar/ProtocolTargetSelector.tsx` の内容を以下に差し替える:

```typescript
import { useState, type JSX } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useAppStore } from '../../store/appStore'
import type { GrpcTarget, HttpTarget, GraphQLTarget } from '../../../../shared/types/project'
import { ProtocolTargetModal } from '../modals/ProtocolTargetModal'

type ModalState =
  | { type: 'add' }
  | { type: 'edit'; target: GrpcTarget | HttpTarget | GraphQLTarget }
  | null

export function ProtocolTargetSelector(): JSX.Element {
  const project = useProjectStore((s) => s.project)
  const addProtocolTarget = useProjectStore((s) => s.addProtocolTarget)
  const updateProtocolTarget = useProjectStore((s) => s.updateProtocolTarget)
  const deleteProtocolTarget = useProjectStore((s) => s.deleteProtocolTarget)
  const activeProtocol = useAppStore((s) => s.activeProtocol)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const activeProtocolTargetId = useAppStore((s) => s.activeProtocolTargetId)
  const setActiveProtocolTargetId = useAppStore((s) => s.setActiveProtocolTargetId)

  const [modal, setModal] = useState<ModalState>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const env =
    project?.environments.find((e) => e.id === activeEnvironmentId) ?? project?.environments[0]

  // 各プロトコルターゲット型（GrpcTarget等）は name/id を共通で持つため共通型にキャストする
  const targets =
    (env?.protocols?.[activeProtocol] as Array<{ id: string; name: string }> | undefined) ?? []
  const active = targets.find((t) => t.id === activeProtocolTargetId) ?? targets[0]

  const activeEnvId = env?.id ?? ''

  const persistProject = async (): Promise<boolean> => {
    const p = useProjectStore.getState().project
    if (!p) return false
    try {
      await window.reqstraApi.saveProject(p)
      setSaveError(null)
      return true
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
      return false
    }
  }

  const handleSubmit = async (target: GrpcTarget | HttpTarget | GraphQLTarget): Promise<void> => {
    if (modal?.type === 'add') {
      addProtocolTarget(activeEnvId, activeProtocol, target)
      setActiveProtocolTargetId(target.id)
    } else {
      updateProtocolTarget(activeEnvId, activeProtocol, target)
    }
    if (await persistProject()) setModal(null)
  }

  const handleDelete = async (targetId: string): Promise<void> => {
    deleteProtocolTarget(activeEnvId, activeProtocol, targetId)
    if (activeProtocolTargetId === targetId) {
      const remaining =
        (useProjectStore.getState().project?.environments
          .find((e) => e.id === activeEnvId)
          ?.protocols?.[activeProtocol] as Array<{ id: string }> | undefined) ?? []
      setActiveProtocolTargetId(remaining[0]?.id ?? null)
    }
    if (await persistProject()) setModal(null)
  }

  return (
    <div className="border-b border-[var(--color-border)] px-2 py-1">
      <div className="flex items-center gap-1">
        <select
          value={active?.id ?? ''}
          onChange={(e) => setActiveProtocolTargetId(e.target.value)}
          className="min-w-0 flex-1 rounded bg-[#3c3c3c] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none"
        >
          {targets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
          {targets.length === 0 && <option value="">ターゲット未設定</option>}
        </select>
        {active && (
          <button
            type="button"
            onClick={() => {
              const fullTarget =
                (env?.protocols?.[activeProtocol] as Array<GrpcTarget | HttpTarget | GraphQLTarget> | undefined)
                  ?.find((t) => t.id === active.id)
              if (fullTarget) setModal({ type: 'edit', target: fullTarget })
            }}
            title="ターゲットを編集"
            className="shrink-0 rounded bg-[#3c3c3c] px-1.5 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            ✎
          </button>
        )}
        <button
          type="button"
          onClick={() => setModal({ type: 'add' })}
          title="ターゲットを追加"
          className="shrink-0 rounded bg-[var(--color-bg-active)] px-1.5 py-1 text-xs text-white"
        >
          ＋
        </button>
      </div>
      {saveError && <p className="mt-1 text-xs text-[var(--color-error)]">{saveError}</p>}
      {modal && (
        <ProtocolTargetModal
          mode={modal.type}
          protocol={activeProtocol}
          initial={modal.type === 'edit' ? modal.target : undefined}
          onSubmit={handleSubmit}
          onDelete={modal.type === 'edit' ? () => handleDelete(modal.target.id) : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: 全テストが通ることを確認する**

```bash
npm run test -- --project renderer
```

Expected: PASS

- [ ] **Step 3: コミットする**

```bash
git add src/renderer/src/components/Sidebar/ProtocolTargetSelector.tsx
git commit -m "feat: ProtocolTargetSelectorにターゲット追加/編集ボタンを追加"
```

---

### Task 8: CollectionTree — ＋/✎/× ボタン + モーダル統合

**Files:**
- Modify: `src/renderer/src/components/Sidebar/CollectionTree.tsx`

- [ ] **Step 1: CollectionTree を改修する**

`src/renderer/src/components/Sidebar/CollectionTree.tsx` の内容を以下に差し替える:

```typescript
import { useState, type JSX } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useAppStore } from '../../store/appStore'
import type { Collection, GrpcEndpoint } from '../../../../shared/types/project'
import { CollectionModal } from '../modals/CollectionModal'
import { EndpointModal } from '../modals/EndpointModal'
import * as path from 'path'

type ModalState =
  | { type: 'add-collection' }
  | { type: 'edit-collection'; collection: Collection }
  | { type: 'add-endpoint'; collectionId: string }
  | { type: 'edit-endpoint'; collectionId: string; endpoint: GrpcEndpoint }
  | null

export function CollectionTree(): JSX.Element {
  const project = useProjectStore((s) => s.project)
  const addCollection = useProjectStore((s) => s.addCollection)
  const updateCollection = useProjectStore((s) => s.updateCollection)
  const deleteCollection = useProjectStore((s) => s.deleteCollection)
  const addEndpoint = useProjectStore((s) => s.addEndpoint)
  const updateEndpoint = useProjectStore((s) => s.updateEndpoint)
  const deleteEndpoint = useProjectStore((s) => s.deleteEndpoint)
  const activeProtocol = useAppStore((s) => s.activeProtocol)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const openTab = useAppStore((s) => s.openTab)

  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set())
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<string>>(new Set())
  const [casesByEndpoint, setCasesByEndpoint] = useState<Record<string, string[]>>({})
  const [modalState, setModalState] = useState<ModalState>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const collections = (project?.collections ?? []).filter((c) => c.protocol === activeProtocol)
  const activeEnv =
    project?.environments.find((e) => e.id === activeEnvironmentId) ?? project?.environments[0]

  const persistProject = async (): Promise<boolean> => {
    const p = useProjectStore.getState().project
    if (!p) return false
    try {
      await window.reqstraApi.saveProject(p)
      setSaveError(null)
      return true
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
      return false
    }
  }

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

  const handleCaseClick = (_col: Collection, ep: GrpcEndpoint, caseName: string): void => {
    openTab({
      id: `${ep.id}::${caseName}`,
      label: `${ep.name} / ${caseName.replace(/\.ya?ml$/, '')}`,
      endpointId: ep.id,
      caseName,
    })
  }

  const handleCollectionSubmit = async (col: Collection): Promise<void> => {
    if (modalState?.type === 'add-collection') {
      addCollection(col)
    } else {
      updateCollection(col)
    }
    if (await persistProject()) setModalState(null)
  }

  const handleCollectionDelete = async (id: string): Promise<void> => {
    if (!window.confirm('コレクションを削除しますか？')) return
    deleteCollection(id)
    if (await persistProject()) return
  }

  const handleEndpointSubmit = async (ep: GrpcEndpoint): Promise<void> => {
    if (modalState?.type === 'add-endpoint') {
      addEndpoint(modalState.collectionId, ep)
    } else if (modalState?.type === 'edit-endpoint') {
      updateEndpoint(modalState.collectionId, ep)
    }
    if (await persistProject()) setModalState(null)
  }

  const handleEndpointDelete = async (collectionId: string, endpointId: string): Promise<void> => {
    if (!window.confirm('エンドポイントを削除しますか？')) return
    deleteEndpoint(collectionId, endpointId)
    await persistProject()
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-2 py-1">
        <span className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
          コレクション
        </span>
        <button
          type="button"
          onClick={() => setModalState({ type: 'add-collection' })}
          title="コレクションを追加"
          className="rounded bg-[var(--color-bg-active)] px-1.5 py-0.5 text-xs text-white"
        >
          ＋
        </button>
      </div>

      {saveError && <p className="px-2 pt-1 text-xs text-[var(--color-error)]">{saveError}</p>}

      <div className="flex-1 overflow-y-auto py-1 text-xs">
        {collections.length === 0 && (
          <p className="px-3 text-[var(--color-text-secondary)]">コレクションなし</p>
        )}
        {collections.map((col) => (
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
                <button
                  type="button"
                  onClick={() => setModalState({ type: 'add-endpoint', collectionId: col.id })}
                  title="エンドポイントを追加"
                  className="rounded px-1 py-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  ＋
                </button>
                <button
                  type="button"
                  onClick={() => setModalState({ type: 'edit-collection', collection: col })}
                  title="コレクションを編集"
                  className="rounded px-1 py-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => handleCollectionDelete(col.id)}
                  title="コレクションを削除"
                  className="rounded px-1 py-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-error)]"
                >
                  ×
                </button>
              </div>
            </div>
            {expandedCollections.has(col.id) &&
              col.endpoints.map((ep) => (
                <div key={ep.id}>
                  <div className="group flex items-center py-0.5 pl-5 pr-2 hover:bg-[var(--color-bg-tertiary)]">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center text-left text-[var(--color-text-primary)]"
                      onClick={() => toggleEndpoint(ep)}
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
                      <button
                        key={caseName}
                        type="button"
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

      {modalState?.type === 'add-collection' && (
        <CollectionModal
          mode="add"
          environment={activeEnv}
          onSubmit={handleCollectionSubmit}
          onClose={() => setModalState(null)}
        />
      )}
      {modalState?.type === 'edit-collection' && (
        <CollectionModal
          mode="edit"
          initial={modalState.collection}
          environment={activeEnv}
          onSubmit={handleCollectionSubmit}
          onClose={() => setModalState(null)}
        />
      )}
      {modalState?.type === 'add-endpoint' && (
        <EndpointModal
          mode="add"
          protocol={activeProtocol}
          onSubmit={handleEndpointSubmit}
          onClose={() => setModalState(null)}
        />
      )}
      {modalState?.type === 'edit-endpoint' && (
        <EndpointModal
          mode="edit"
          protocol={activeProtocol}
          initial={modalState.endpoint}
          onSubmit={handleEndpointSubmit}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: 全テストが通ることを確認する**

```bash
npm run test
```

Expected: PASS（全テスト）

- [ ] **Step 3: コミットする**

```bash
git add src/renderer/src/components/Sidebar/CollectionTree.tsx
git commit -m "feat: CollectionTreeにコレクション/エンドポイントの追加・編集・削除ボタンを追加"
```
