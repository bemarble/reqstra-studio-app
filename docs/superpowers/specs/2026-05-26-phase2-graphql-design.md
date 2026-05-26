# Reqstra Studio Phase 2: GraphQL 設計ドキュメント

**作成日**: 2026-05-26  
**ステータス**: 承認済み

---

## 概要

Phase 1 で構築した gRPC 基盤の上に GraphQL プロトコルを追加する。  
HTTP POST ベースのリクエスト実行・HTTP ヘッダー設定・認証（Bearer / Basic Auth / OAuth2）・スキーマイントロスペクション（表示のみ）を実装する。

---

## データモデル変更

### `GraphQLTarget`（`src/shared/types/project.ts`）

`host: string` を `url: string` に変更（フル URL 形式）。

```typescript
export interface GraphQLTarget {
  id: string
  name: string
  url: string  // "http://localhost:8080/graphql"
}
```

### `GraphQLEndpoint`（新規追加）

gRPC の `method` フィールドは GraphQL に不要なため、専用の型を定義する。

```typescript
export interface GraphQLEndpoint {
  id: string
  name: string      // 操作名 e.g. "GetUser"
  casesDir: string  // "requests/graphql/GetUser"
}
```

### `Collection`（修正）

`endpoints` を Union 型に変更。`protocol` フィールドで実際の型を判別する。

```typescript
export interface Collection {
  id: string
  protocol: 'grpc' | 'graphql' | 'http'
  name: string
  protocolTargetId: string
  endpoints: GrpcEndpoint[] | GraphQLEndpoint[]
}
```

---

## ケースファイル形式

```yaml
# requests/graphql/GetUser/UserA.yaml
query: |
  query GetUser($id: ID!) {
    user(id: $id) {
      name
      email
    }
  }
variables:
  id: "alice-123"
auth:
  type: bearer        # none | bearer | basic | oauth2
  token: "my-token"  # bearer / oauth2 用
  # username: "admin"  # basic 用
  # password: "secret" # basic 用
headers:
  X-Custom-Header: "value"
```

実行時に `auth` フィールドを `Authorization` ヘッダーへ変換してリクエスト送信する。  
ファイル自体は生の設定値を YAML で保持（変換は実行時のみ）。

---

## IPC 型定義（`src/shared/types/ipc.ts`）

### 追加型

```typescript
export type GraphQLAuthType = 'none' | 'bearer' | 'basic' | 'oauth2'

export interface GraphQLAuth {
  type: GraphQLAuthType
  token?: string      // bearer / oauth2
  username?: string   // basic
  password?: string   // basic
}

export interface GraphQLRequestParams {
  url: string
  query: string
  variables: string              // YAML 文字列（実行時にパース）
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
```

### `IpcApi` への追加

```typescript
graphqlRequest: (params: GraphQLRequestParams) => Promise<GraphQLResponse>
graphqlIntrospect: (url: string, headers: Record<string, string>, auth: GraphQLAuth) => Promise<string>
```

---

## Main Process 実装

### 新規ファイル

```
src/main/
└── graphql/
    └── client.ts     # リクエスト実行・イントロスペクション
src/main/ipc/
└── graphql.ts        # IPC ハンドラー登録
```

### `src/main/graphql/client.ts`

- `parseGraphQLCase(yaml: string)` — YAML から `{ query, variables, headers, auth }` を抽出
- `buildAuthHeader(auth: GraphQLAuth)` — 認証設定を `Authorization` ヘッダー文字列に変換
- `executeGraphQLRequest(params)` — `graphql-request` でリクエスト実行
- `introspectSchema(url, headers, auth)` — IntrospectionQuery を送信してスキーマ JSON を返す

### `src/main/ipc/graphql.ts`

```typescript
ipcMain.handle('graphql:request', ...)
ipcMain.handle('graphql:introspect', ...)
```

`src/main/ipc/index.ts` の `registerAllHandlers()` に `registerGraphQLHandlers()` を追加。

### 追加パッケージ

```bash
npm install graphql graphql-request
```

---

## UI 実装

### 新規ファイル

```
src/renderer/src/components/
├── MainPanel/
│   └── GraphQLPanel/
│       ├── index.tsx           # メインパネル（状態管理・Send/Introspect処理）
│       ├── QueryEditor.tsx     # Query + Variables + Headers + Auth の左ペイン
│       └── ResponseViewer.tsx  # レスポンス表示
└── modals/
    └── GraphQLEndpointModal.tsx  # エンドポイント追加/編集モーダル
```

### `GraphQLPanel` レイアウト

```
+--[GraphQL] http://localhost:8080/graphql -- [Introspect] [▶ Send]--+
|                                                                      |
| +-- QueryEditor（ResizablePanes 縦）---+  +-- ResponseViewer ------+ |
| | クエリエディタ (Monaco / graphql)    |  | ● OK  43ms            | |
| |                                    |  | { "data": {...} }      | |
| +------------------------------------+  |                        | |
| | 変数エディタ (Monaco / yaml)         |  |                        | |
| |                                    |  |                        | |
| +--[Headers]--[Auth]-----------------+  +------------------------+ |
| | Headers: キー/バリューフォーム        |                            |
| | Auth: タイプ選択 + 対応フィールド     |                            |
| +------------------------------------+                            |
+----------------------------------------------------------------------+
```

- 左ペイン上段：クエリエディタ（`ResizablePanes` 縦で高さ調整可能）
- 左ペイン中段：変数エディタ（常時表示）
- 左ペイン下段：`[Headers]` / `[Auth]` タブ切り替え（固定高さ）
- 左右分割は既存 `ResizablePanes`（横）を使用

### Auth タブ仕様

| 認証タイプ | 入力フィールド | Authorization ヘッダー変換 |
|---|---|---|
| None | なし | ヘッダーなし |
| Bearer Token | Token | `Bearer <token>` |
| Basic Auth | Username / Password | `Basic <base64(user:pass)>` |
| OAuth2 | Access Token | `Bearer <accessToken>` |

### Pretty ボタン

クエリエディタのツールバーに「Pretty」ボタンを設置。クリックすると `graphql` パッケージの `parse` + `print` でクエリを整形する。整形処理は Renderer 側で完結（IPC 不要）。パースエラー時はボタンを無効化または無視。

### クエリバリデーション

クエリ入力のたびに `graphql` パッケージの `parse` でシンタックスチェックを行う（Renderer 側で完結）。

- パースエラーがある場合：Send ボタンを無効化し、エディタ下部にエラーメッセージを表示
- エラーがない場合：Send ボタンを有効化

スキーマを取得していない段階ではシンタックスチェックのみ（フィールドの存在チェック等のセマンティクス検証は行わない）。

### CollectionTree 変更点

- `activeProtocol === 'graphql'` の場合、gRPC の「取得（Reflect）」ボタンを非表示にし、「＋エンドポイント」ボタンを表示
- エンドポイント追加・編集は `GraphQLEndpointModal`（name + casesDir を入力）
- ケース操作（複製・削除）は gRPC と共通のロジックをそのまま使用

### `MainPanel/index.tsx` 変更

```typescript
{activeTab && activeProtocol === 'graphql' && (
  <GraphQLPanel key={activeTab.id} tab={activeTab} />
)}
```

---

## テスト戦略

### Main Process（TDD）

| ファイル | 関数 | テスト内容 |
|---|---|---|
| `tests/main/graphql/client.test.ts` | `parseGraphQLCase` | YAML から query / variables / headers / auth を正しく抽出できる |
| `tests/main/graphql/client.test.ts` | `buildAuthHeader` | 各認証タイプから正しい Authorization ヘッダーが生成される |

ネットワーク通信（`graphql-request` の実際の HTTP 送信）はユニットテスト対象外。

### Renderer

`GraphQLEndpoint` を含む `Collection` の CRUD は既存 `projectStore` の操作で対応できるため、追加テストなし。

---

## スコープ外（将来対応）

- Monaco Editor での GraphQL スキーマ補完
- OAuth2 Authorization Code Flow（自動トークン取得）
- GraphQL Subscriptions（WebSocket）
