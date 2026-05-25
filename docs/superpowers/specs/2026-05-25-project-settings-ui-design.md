# プロジェクト設定UI 設計ドキュメント

## Goal

`reqstra-project.json` を手動編集せずに、UI上から環境・プロトコルターゲット・コレクション・エンドポイントを追加・編集・削除できるようにする。

## Architecture

既存の `saveProject` IPC を再利用する。新しい IPC ハンドラーは不要。  
ユーザー操作 → モーダル送信 → `projectStore` 更新 → `window.reqstraApi.saveProject(project)` → `reqstra-project.json` 保存。

すべての変更はモーダルの「追加/保存」ボタンを押した時点で即座に保存する。

## UI アクセスパターン

サイドバーのセレクター・ツリーにボタンを追加し、クリックでモーダルを開く（小さな個別モーダル）。

```
EnvironmentSelector:      [🌍 dev ▾] [✎] [＋]
ProtocolTargetSelector:   [localhost:50051 ▾] [✎] [＋]
CollectionTree（コレクション行）: [▸ UserService] [＋endpoint] [✎] [×]
CollectionTree（エンドポイント行）: [  ▸ GetUser] [✎] [×]
```

新規プロジェクト（空の状態）でも同じUIを使う。ウィザードや初期サンプルデータは提供しない。

## モーダルコンポーネント

各モーダルは `mode: 'add' | 'edit'` プロパティを受け取り、add/edit を1つのコンポーネントで兼ねる。`edit` 時はフォームに既存値を初期表示し、ボタンラベルを「追加」→「保存」に切り替える。

### EnvironmentModal

**ファイル:** `src/renderer/src/components/modals/EnvironmentModal.tsx`

```typescript
interface Props {
  mode: 'add' | 'edit'
  initial?: Environment
  onSubmit: (env: Environment) => void
  onClose: () => void
}
```

フォームフィールド:
- 名前（必須）

### ProtocolTargetModal

**ファイル:** `src/renderer/src/components/modals/ProtocolTargetModal.tsx`

```typescript
interface Props {
  mode: 'add' | 'edit'
  protocol: 'grpc' | 'http' | 'graphql'
  initial?: GrpcTarget | HttpTarget | GraphQLTarget
  onSubmit: (target: GrpcTarget | HttpTarget | GraphQLTarget) => void
  onClose: () => void
}
```

フォームフィールド（プロトコル別）:
- gRPC: 名前（必須）、ホスト（必須、例: `localhost:50051`）、TLS（チェックボックス）
- HTTP: 名前（必須）、Base URL（必須、例: `http://localhost:3000`）
- GraphQL: 名前（必須）、ホスト（必須）

### CollectionModal

**ファイル:** `src/renderer/src/components/modals/CollectionModal.tsx`

```typescript
interface Props {
  mode: 'add' | 'edit'
  initial?: Collection
  availableTargets: Array<{ id: string; name: string }>
  onSubmit: (col: Collection) => void
  onClose: () => void
}
```

フォームフィールド:
- 名前（必須）
- プロトコル（grpc / http / graphql のセレクト、edit 時は変更不可）
- ターゲット（現在の環境・プロトコルに属するターゲットのセレクト）

### EndpointModal

**ファイル:** `src/renderer/src/components/modals/EndpointModal.tsx`

```typescript
interface Props {
  mode: 'add' | 'edit'
  protocol: 'grpc' | 'http' | 'graphql'
  initial?: GrpcEndpoint
  onSubmit: (ep: GrpcEndpoint) => void
  onClose: () => void
}
```

フォームフィールド:
- 名前（必須）
- メソッド（必須、例: `UserService/GetUser`）
- `casesDir` は `method` から自動生成（表示のみ）

**`casesDir` 自動生成ルール:**

```
method: "UserService/GetUser"
→ casesDir: "requests/grpc/UserService/GetUser"
```

フォーマット: `requests/{protocol}/{method文字列のスラッシュをパス区切りにそのまま使用}`

## projectStore の追加アクション

`src/renderer/src/store/projectStore.ts` に以下を追加する。

```typescript
deleteEnvironment: (id: string) => void
addProtocolTarget: (envId: string, protocol: 'grpc' | 'http' | 'graphql', target: GrpcTarget | HttpTarget | GraphQLTarget) => void
updateProtocolTarget: (envId: string, protocol: 'grpc' | 'http' | 'graphql', target: GrpcTarget | HttpTarget | GraphQLTarget) => void
deleteProtocolTarget: (envId: string, protocol: 'grpc' | 'http' | 'graphql', targetId: string) => void
deleteCollection: (id: string) => void
addEndpoint: (collectionId: string, endpoint: GrpcEndpoint) => void
updateEndpoint: (collectionId: string, endpoint: GrpcEndpoint) => void
deleteEndpoint: (collectionId: string, endpointId: string) => void
```

## 既存コンポーネントの変更

### EnvironmentSelector.tsx

- 現在の環境の `✎`（編集）ボタンを追加 → `EnvironmentModal(mode='edit')` を開く
- `＋`（追加）ボタンを追加 → `EnvironmentModal(mode='add')` を開く
- 削除は `✎` モーダル内に「削除」ボタンとして配置、`window.confirm` で確認後に `deleteEnvironment` を呼ぶ

### ProtocolTargetSelector.tsx

- 現在のターゲットの `✎` ボタンを追加 → `ProtocolTargetModal(mode='edit')` を開く
- `＋` ボタンを追加 → `ProtocolTargetModal(mode='add')` を開く
- 削除は `✎` モーダル内に「削除」ボタンとして配置

### CollectionTree.tsx

- コレクション行に `＋`（エンドポイント追加）・`✎`（コレクション編集）・`×`（コレクション削除）ボタンを追加
- エンドポイント行に `✎`（エンドポイント編集）・`×`（エンドポイント削除）ボタンを追加
- コレクション・エンドポイント削除は `window.confirm` で確認

## エラーハンドリング

- モーダルのフォームバリデーション: 必須フィールドが空の場合、送信ボタンを無効化またはエラーメッセージを表示する
- `saveProject` 失敗時: エラーメッセージをモーダル内またはトースト通知で表示する
- 環境削除時の参照整合性: 削除する環境のターゲットを参照しているコレクションがある場合、確認メッセージに警告を含める（削除はブロックしない）

## テスト方針

- `projectStore` の新アクション（`deleteEnvironment`, `addProtocolTarget` 等）を Zustand ストアのユニットテストで検証する（`tests/renderer/store/projectStore.test.ts`）
- モーダルコンポーネントのテストはスナップショットではなく、フォーム送信・バリデーション動作を検証する
