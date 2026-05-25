# ケース削除機能 設計ドキュメント

**作成日:** 2026-05-25

## Goal

サイドバーの CollectionTree に表示されているケース（YAML ファイル）を UI から削除できるようにする。削除と同時に、そのケースを開いているタブは自動でクローズする。

## Architecture

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `src/shared/types/ipc.ts` | `IpcApi` に `deleteCase` を追加 |
| `src/main/ipc/project.ts` | `deleteCase(absolutePath)` を実装（`fs.unlink`） |
| `src/preload/index.ts` | `deleteCase` を contextBridge に追加 |
| `src/renderer/src/components/Sidebar/CollectionTree.tsx` | ケース行に削除ボタンを追加、タブ自動クローズ |
| `tests/main/ipc/project.test.ts` | `deleteCase` のユニットテストを追加 |

### IPC チェーン

```
CollectionTree
  → window.reqstraApi.deleteCase(absolutePath)
    → preload: ipcRenderer.invoke('project:deleteCase', absolutePath)
      → main: fs.unlink(absolutePath)
```

## UI の振る舞い

- ケース行をホバーすると `×` ボタンが表示される（コレクション・エンドポイント削除と同一パターン）
- `×` クリック → `window.confirm` 確認ダイアログ
- 確認後:
  1. `window.reqstraApi.deleteCase(absolutePath)` でファイル削除
  2. `casesByEndpoint` ローカル状態から該当ケースを除去（UI 即時更新）
  3. `id === \`${ep.id}::${caseName}\`` のタブが開いていれば `closeTab` で閉じる

## IPC 型定義

```typescript
// src/shared/types/ipc.ts
export interface IpcApi {
  // ... 既存メソッド ...
  deleteCase: (absolutePath: string) => Promise<void>
}
```

## Main Process 実装

```typescript
// src/main/ipc/project.ts
export async function deleteCase(absolutePath: string): Promise<void> {
  await fs.unlink(absolutePath)
}
```

## テスト方針

`tests/main/ipc/project.test.ts` に追加：

- tmpディレクトリにファイルを作成 → `deleteCase` → ファイルが存在しないことを確認
- 存在しないファイルへの `deleteCase` はエラーをスローする

## スコープ外

- ケースが存在しないときの CollectionTree の自動再読み込み（ユーザー操作起点なので不要）
- undo / ゴミ箱への移動（シンプルな完全削除で十分）
