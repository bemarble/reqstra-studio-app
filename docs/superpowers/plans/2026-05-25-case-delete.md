# ケース削除機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CollectionTree のケース行にホバーで表示される削除ボタンを追加し、確認後にファイルを削除・対応タブを閉じる。

**Architecture:** `deleteCase(absolutePath)` を IPC チェーンに追加（`project.ts` → `ipc/index.ts` → `preload`）し、CollectionTree 側でケース行のレイアウトをグループ化して削除ボタンを追加する。ファイル削除後は `casesByEndpoint` ローカル状態と Zustand の `openTabs` を両方更新する。

**Tech Stack:** Electron IPC (`ipcMain.handle`), `fs.unlink`, React useState, Zustand (`closeTab`), Vitest (node 環境)

---

## File Structure

| 操作 | ファイル |
|---|---|
| 変更 | `src/shared/types/ipc.ts` |
| 変更 | `src/main/ipc/project.ts` |
| 変更 | `src/main/ipc/index.ts` |
| 変更 | `src/preload/index.ts` |
| 変更 | `tests/main/ipc/project.test.ts` |
| 変更 | `src/renderer/src/components/Sidebar/CollectionTree.tsx` |

---

### Task 1: `deleteCase` IPC の追加（テスト → 実装）

**Files:**
- Modify: `src/shared/types/ipc.ts`
- Modify: `src/main/ipc/project.ts`
- Modify: `src/main/ipc/index.ts`
- Modify: `src/preload/index.ts`
- Modify: `tests/main/ipc/project.test.ts`

- [ ] **Step 1: テストを書く**

`tests/main/ipc/project.test.ts` の末尾に追記する：

```typescript
describe('deleteCase', () => {
  it('YAMLファイルを削除する', async () => {
    const dir = await tmpDir()
    const filePath = path.join(dir, 'test.yaml')
    await fs.writeFile(filePath, 'user_id: alice')

    await deleteCase(filePath)

    await expect(fs.access(filePath)).rejects.toThrow()
  })

  it('存在しないファイルはエラーをスローする', async () => {
    const dir = await tmpDir()
    const filePath = path.join(dir, 'nonexistent.yaml')

    await expect(deleteCase(filePath)).rejects.toThrow()
  })
})
```

`import` 行を以下に更新する（`deleteCase` を追加）：

```typescript
import { readProject, saveProject, listCases, readCase, writeCase, deleteCase } from '../../../src/main/ipc/project'
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npm run test -- --project main
```

期待: FAIL（`deleteCase is not a function`）

- [ ] **Step 3: `project.ts` に `deleteCase` を実装する**

`src/main/ipc/project.ts` の末尾に追記する：

```typescript
export async function deleteCase(absolutePath: string): Promise<void> {
  await fs.unlink(absolutePath)
}
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npm run test -- --project main
```

期待: PASS（新規2テストを含む全 main テスト）

- [ ] **Step 5: `IpcApi` に `deleteCase` を追加する**

`src/shared/types/ipc.ts` の `IpcApi` インターフェースに追加する（`writeCase` の次の行）：

```typescript
// 変更前
  writeCase: (absolutePath: string, content: string) => Promise<void>
  listCases: (absoluteCasesDir: string) => Promise<string[]>

// 変更後
  writeCase: (absolutePath: string, content: string) => Promise<void>
  deleteCase: (absolutePath: string) => Promise<void>
  listCases: (absoluteCasesDir: string) => Promise<string[]>
```

- [ ] **Step 6: `ipc/index.ts` にハンドラーを登録する**

`src/main/ipc/index.ts` の import 行を更新する：

```typescript
// 変更前
import { readProject, saveProject, listCases, readCase, writeCase } from './project'

// 変更後
import { readProject, saveProject, listCases, readCase, writeCase, deleteCase } from './project'
```

`registerAllHandlers()` 内に追加する（`project:writeCase` ハンドラーの直後）：

```typescript
  ipcMain.handle('project:deleteCase', async (_event, absolutePath: string) => {
    await deleteCase(absolutePath)
  })
```

- [ ] **Step 7: `preload/index.ts` に追加する**

`src/preload/index.ts` の `api` オブジェクトに追加する（`writeCase` の次の行）：

```typescript
// 変更前
  writeCase: (absolutePath, content) =>
    ipcRenderer.invoke('project:writeCase', absolutePath, content),

// 変更後
  writeCase: (absolutePath, content) =>
    ipcRenderer.invoke('project:writeCase', absolutePath, content),
  deleteCase: (absolutePath) => ipcRenderer.invoke('project:deleteCase', absolutePath),
```

- [ ] **Step 8: 全テストが通ることを確認する**

```bash
npm run test
```

期待: 全テスト PASS

- [ ] **Step 9: コミットする**

```bash
git add \
  src/shared/types/ipc.ts \
  src/main/ipc/project.ts \
  src/main/ipc/index.ts \
  src/preload/index.ts \
  tests/main/ipc/project.test.ts
git commit -m "feat: deleteCase IPCハンドラーを追加"
```

---

### Task 2: CollectionTree にケース削除ボタンを追加

**Files:**
- Modify: `src/renderer/src/components/Sidebar/CollectionTree.tsx`

- [ ] **Step 1: `closeTab` をストアから取得する**

`src/renderer/src/components/Sidebar/CollectionTree.tsx` で `openTab` を取得している行の直後に追加する：

```typescript
// 変更前
  const openTab = useAppStore((s) => s.openTab)

// 変更後
  const openTab = useAppStore((s) => s.openTab)
  const closeTab = useAppStore((s) => s.closeTab)
```

- [ ] **Step 2: `handleCaseDelete` ハンドラーを追加する**

`handleCaseClick` 関数の直後に追加する：

```typescript
  const handleCaseDelete = async (ep: GrpcEndpoint, caseName: string): Promise<void> => {
    if (!project) return
    if (!window.confirm(`"${caseName.replace(/\.ya?ml$/, '')}" を削除しますか？`)) return
    const absolutePath = path.join(project.projectDir, ep.casesDir, caseName)
    try {
      await window.reqstraApi.deleteCase(absolutePath)
      setCasesByEndpoint((prev) => ({
        ...prev,
        [ep.id]: (prev[ep.id] ?? []).filter((c) => c !== caseName),
      }))
      closeTab(`${ep.id}::${caseName}`)
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    }
  }
```

- [ ] **Step 3: ケース行の JSX をグループレイアウトに変更する**

現在のケース行 JSX（`expandedEndpoints.has(ep.id) &&` の内側）を以下に置き換える：

```typescript
// 変更前
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

// 変更後
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
```

- [ ] **Step 4: 全テストが通ることを確認する**

```bash
npm run test
```

期待: 全テスト PASS（レンダラーテストを含む）

- [ ] **Step 5: コミットする**

```bash
git add src/renderer/src/components/Sidebar/CollectionTree.tsx
git commit -m "feat: CollectionTreeのケース行に削除ボタンを追加"
```
