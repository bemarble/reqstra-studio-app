# gRPCリクエスト機能改善 — 設計ドキュメント

**日付:** 2026-05-25  
**ブランチ:** feat/grpc-request-improvements

---

## 概要

gRPCリクエスト画面のUXを改善する。ペインリサイズ、エンドポイント表示、コレクションツリーの初期状態・マージ挙動、Metadataエディタの編集可能化が対象。

---

## 変更一覧

| # | 分類 | 内容 |
|---|---|---|
| 1 | UI | ペインのドラッグリサイズ（サイドバー↔メイン、リクエスト↔レスポンス） |
| 2 | UI | リクエスト画面上部にエンドポイント（host + method）を表示 |
| 3 | UI | gRPCコレクションの削除・編集ボタンを非表示 |
| 4 | 機能 | Metadataの既存エントリをインライン編集可能に |
| 5 | 機能 | 起動時はケースファイルが存在するエンドポイントのみ表示 |
| 6 | 機能 | 「取得」を置換ではなくマージ動作に変更 |

---

## 設計詳細

### 1. ペインリサイズ

#### コンポーネント構成

```
ResizablePanes（新規: src/renderer/src/components/shared/ResizablePanes.tsx）
  ├ 左ペイン（children[0]）
  ├ DragHandle（幅4pxの透明縦帯）
  └ 右ペイン（children[1]）
```

#### Props

```typescript
interface ResizablePanesProps {
  defaultLeftWidth: number      // px
  minLeft?: number              // px (default: 120)
  minRight?: number             // px (default: 200)
  storageKey?: string           // localStorageキー
  children: [React.ReactNode, React.ReactNode]
}
```

#### 動作

- `onMouseDown` でドラッグ開始、`onMouseMove` で `leftWidth` を更新、`onMouseUp` で終了
- ドラッグ中はカーソルを `col-resize` に固定（bodyに直接設定してペイン外に出ても維持）
- `storageKey` が指定された場合、幅を `localStorage` に保存して再起動後も維持

#### DragHandleスタイル

- 幅: 4px、透明（`background: transparent`）
- ホバー: `--color-text-accent` 色に変色
- カーソル: `col-resize`

#### 適用箇所

| 境界 | 場所 | storageKey | デフォルト幅 |
|---|---|---|---|
| サイドバー↔メイン | `src/renderer/src/App.tsx`（`<Sidebar />`と`<MainPanel />`をラップ） | `pane-sidebar-width` | 240px |
| リクエスト↔レスポンス | `src/renderer/src/components/MainPanel/GrpcPanel/index.tsx` | `pane-response-width` | 320px |

---

### 2. エンドポイント表示（GrpcPanel上部）

#### 現在

```
[gRPC]  UserService/GetUser
```

#### 変更後

```
[gRPC]  localhost:50051  /  UserService/GetUser
```

- `activeTarget.host + " / " + endpoint.method` を表示
- ターゲット未設定時: `(ターゲット未設定) / UserService/GetUser`
- エンドポイント未設定時（tab.labelのみのケース）: `tab.label` をフォールバック

---

### 3. gRPCコレクション削除・編集ボタン非表示

`CollectionTree.tsx` のコレクション行ホバーメニューを変更：

```tsx
// gRPC: 削除（×）ボタンのみ非表示。編集（✎）は残す
{col.protocol !== 'grpc' && (
  <button onClick={() => handleCollectionDelete(col.id)}>×</button>
)}
```

- `handleCollectionDelete` / `deleteCollection` のロジックは削除しない（他プロトコル向けに残す）
- 編集（✎）ボタンは gRPC でも引き続き表示する

---

### 4. Metadataインライン編集

#### 現在

既存エントリは `<span>` で表示（読み取り専用）。新規追加フォームのみ編集可能。

#### 変更後

各エントリの key・value を `<input>` に変更：

```tsx
// MetadataEditor.tsx
<input
  value={k}
  onChange={(e) => handleKeyChange(k, e.target.value)}
  className="flex-1 rounded bg-[#3c3c3c] px-2 py-0.5 text-[var(--color-text-accent)] outline-none"
/>
<input
  value={v}
  onChange={(e) => handleValueChange(k, e.target.value)}
  className="flex-1 rounded bg-[#3c3c3c] px-2 py-0.5 text-[var(--color-text-primary)] outline-none"
/>
```

- `handleKeyChange(oldKey, newKey)`: `{...metadata}` から `oldKey` を削除し `newKey` で追加
- `handleValueChange(key, newValue)`: `{...metadata, [key]: newValue}` で更新
- 変更のたびに `onChange` を呼び出してGrpcPanelに即時反映

---

### 5. 起動時フィルタ：ケースファイルが存在するエンドポイントのみ表示

#### 新規IPC: `grpc:scanCaseDirs`

```typescript
// src/shared/types/ipc.ts に追加
scanCaseDirs(projectDir: string): Promise<string[]>
```

Main Process実装（`src/main/ipc/grpc.ts`）:
- `requests/grpc/` 配下を再帰スキャン
- `.yaml` ファイルが1件以上存在するディレクトリのパス一覧を返す
- パスは `reqstra-project.json` の `casesDir` フィールドと同じ形式（プロジェクト相対パス）

#### Zustandストア変更（`projectStore`）

```typescript
// 追加フィールド
activeCaseDirs: Set<string>
setActiveCaseDirs: (dirs: string[]) => void
```

#### 起動フロー

```
プロジェクト読み込み完了（setProject呼び出し後）
  → scanCaseDirs(project.projectDir)
  → setActiveCaseDirs(result)
```

#### CollectionTreeのフィルタリング

```typescript
// isReflected: handleReflect実行後にtrueになるローカルstate
const isEndpointVisible = (ep: GrpcEndpoint): boolean =>
  isReflected || activeCaseDirs.has(ep.casesDir)

// エンドポイントが1件以上visible なコレクションのみ表示
const visibleCollections = collections.filter(col =>
  col.endpoints.some(ep => isEndpointVisible(ep))
)
```

---

### 6. 「取得」マージ動作

#### 現在

アクティブターゲットの全コレクションを反映結果で**置換**。

#### 変更後

既存コレクションを保持しつつ、**新規サービスのみ追加**：

```typescript
const existingNames = new Set(
  p.collections
    .filter(c => c.protocol === 'grpc' && c.protocolTargetId === activeTarget.id)
    .map(c => c.name)
)
const toAdd = fetched.filter(c => !existingNames.has(c.name))
useProjectStore.getState().setProject({
  ...p,
  collections: [...p.collections, ...toAdd],
})
await persistProject()
setIsReflected(true)  // フィルタ解除フラグ
```

- 既存コレクションのエンドポイント追加（サービスが既存でメソッドが増えたケース）は今回スコープ外
- `isReflected` はコンポーネントのローカルstate（`useState<boolean>(false)`）

---

## ファイル変更マップ

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `src/renderer/src/components/shared/ResizablePanes.tsx` | **新規** | ドラッグリサイズコンポーネント |
| `src/renderer/src/App.tsx`（またはルートレイアウト） | 変更 | サイドバー↔メインにResizablePanesを適用 |
| `src/renderer/src/components/MainPanel/GrpcPanel/index.tsx` | 変更 | エンドポイント表示、リクエスト↔レスポンスにResizablePanesを適用 |
| `src/renderer/src/components/Sidebar/CollectionTree.tsx` | 変更 | コレクション削除・編集ボタン非表示、フィルタリング、マージロジック |
| `src/renderer/src/components/MainPanel/GrpcPanel/MetadataEditor.tsx` | 変更 | 既存エントリをinput化 |
| `src/renderer/src/store/projectStore.ts` | 変更 | `activeCaseDirs`・`setActiveCaseDirs`追加 |
| `src/shared/types/ipc.ts` | 変更 | `scanCaseDirs` API定義追加 |
| `src/main/ipc/grpc.ts` | 変更 | `scanCaseDirs` ハンドラ実装 |
| `src/preload/index.ts` | 変更 | `scanCaseDirs` をcontextBridgeに追加 |
| `src/renderer/src/env.d.ts` | 変更 | `scanCaseDirs` の型宣言追加 |

---

## テスト方針

- `scanCaseDirs` のMain Processロジックはvitestでユニットテスト（tmpディレクトリ使用）
- `ResizablePanes` のドラッグ動作はRenderer側のコンポーネントテスト
- `handleReflect` のマージロジックはProjectStoreのテストで検証

---

## スコープ外

- サービスが既存でメソッドが増えたケースのマージ（エンドポイント単位のマージ）
- gRPC以外プロトコル（HTTP・GraphQL）への影響なし
