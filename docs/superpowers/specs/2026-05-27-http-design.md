# HTTP プロトコル実装 設計ドキュメント

**日付:** 2026-05-27  
**ステータス:** 承認済み

---

## 概要

Reqstra Studio に HTTP プロトコルのサポートを追加する。GraphQL 実装と同等の機能を提供し、完全独立実装（アプローチA）で既存コードへの影響をゼロにする。

---

## コレクション構造

GraphQL 式を採用: **コレクション = 1エンドポイント**。

- コレクションにエンドポイント設定（method / path / bodyType / headers / auth）を保持
- ケースはボディ/パラメータの違いのみ

---

## データモデル

### `src/shared/types/project.ts` への追加

```ts
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type HttpBodyType = 'json' | 'query'

export interface HttpEndpoint {
  id: string
  name: string           // 表示名 e.g. "Create User"
  method: HttpMethod
  path: string           // e.g. "/users/:id"
  bodyType: HttpBodyType // コレクション単位で設定
  casesDir: string       // "requests/http/CreateUser"
  headers?: Record<string, string>
  auth?: GraphQLAuth     // 既存の認証型を流用
}
```

`Collection.endpoints` の型を `GrpcEndpoint[] | GraphQLEndpoint[] | HttpEndpoint[]` に拡張。

### ケースファイル (YAML)

**bodyType=json の場合:**
```yaml
body: '{"name": "Alice"}'
pathParams:
  id: "123"
```

**bodyType=query の場合:**
```yaml
params:
  name: Alice
  page: "1"
pathParams:
  id: "123"
```

`pathParams` は path に `:param` 形式のパラメータがある場合のみ使用。

---

## IPC 型定義

### `src/shared/types/ipc.ts` への追加

```ts
export interface HttpRequestParams {
  baseUrl: string
  method: HttpMethod
  path: string
  pathParams: Record<string, string>
  headers: Record<string, string>
  auth: GraphQLAuth
  bodyType: HttpBodyType
  body: string                        // bodyType=json のときの JSON 文字列
  queryParams: Record<string, string> // bodyType=query のときのパラメータ
}

export interface HttpResponse {
  status: 'OK' | 'ERROR'
  body: string            // レスポンスボディ（生文字列）
  httpStatus: number
  durationMs: number
  error?: string
  requestHeaders?: Record<string, string>
  responseHeaders?: Record<string, string>
}
```

`IpcApi` に追加:
```ts
httpRequest: (params: HttpRequestParams) => Promise<HttpResponse>
```

---

## Main Process

### `src/main/http/client.ts`

- `buildUrl(baseUrl, path, pathParams, queryParams)`: パス変換 + クエリ付加
  - `/users/:id` + `{ id: "123" }` → `/users/123`
  - pathParams は `/:param` パターンを正規表現で置換
  - bodyType=query の場合 queryParams を URLSearchParams で付加（body は送信しない）
  - bodyType=json の場合 queryParams は無視（body を送信）
- `buildAuthHeader(auth)`: GraphQL クライアントと同じロジック（独立実装）
- Node.js 組み込みの `fetch` でリクエスト実行
- レスポンスボディは生文字列として返す（Content-Type に依らず）

### `src/main/ipc/http.ts`

```ts
ipcMain.handle('http:request', async (_event, params: HttpRequestParams) => {
  return executeHttpRequest(params)
})
```

### `src/main/ipc/index.ts`

`registerAllHandlers()` に `registerHttpHandlers()` を追加。

---

## UI コンポーネント

### ファイル構成

```
src/renderer/src/components/MainPanel/HttpPanel/
├── index.tsx          ← メインパネル
├── RequestEditor.tsx  ← 左ペイン
└── ResponseViewer.tsx ← 右ペイン
```

### `index.tsx`

- コレクションから `method/path/bodyType/headers/auth` を読み込み、変更時に自動保存（800ms debounce）
- タブ（ケース）切り替えで YAML から `body/params/pathParams` を読み込み、変更時に自動保存
- Send ボタンで `window.reqstraApi.httpRequest()` を呼び出し
- 実行ログを `writeLog` に記録（protocol: 'http'）

### `RequestEditor.tsx`

左ペインを上下分割:

**上段: URL バー（コレクション設定）**
```
[POST ▾] /users/:id
```
- method セレクト: GET / POST / PUT / PATCH / DELETE
- path 入力: フリーテキスト

**下段タブ:**
| タブ | 表示条件 | コンポーネント |
|---|---|---|
| Body | bodyType=json | MonacoEditor (JSON) |
| Query Params | bodyType=query | MetadataEditor（key-value テーブル） |
| Path Params | path に `:param` が存在 | MetadataEditor（key-value テーブル。キーは path から `:param` パターンを抽出して自動生成、値はケースから読み込み） |
| Headers | 常時 | MetadataEditor |
| Auth | 常時 | AuthEditor（GraphQLPanel のものを独立実装） |

bodyType セレクタ（JSON / Query）はタブエリアの右端に配置。

### `ResponseViewer.tsx`

- ステータスバー: HTTP ステータスコード + 経過時間
- エラー時のメッセージ表示
- タブ: `Body` / `Request Headers` / `Response Headers`
- Body: JSON として parse 可能なら MonacoEditor (JSON)、それ以外は plain text

### CollectionTree への変更

- HTTP コレクション追加時、`HttpEndpointModal` を新設
  - 入力項目: name / method / path / bodyType
- HTTP コレクション表示はケースをコレクション直下に表示（GraphQL 同様）
- ＋ ボタンでケース作成（GraphQL 同様）
- `ModalState` に HTTP エンドポイント用の分岐を追加

### モーダル

`src/renderer/src/components/modals/HttpEndpointModal.tsx` を新設:
- 入力: name / method（セレクト）/ path / bodyType（セレクト）

---

## ファイル変更一覧

| ファイル | 変更種別 |
|---|---|
| `src/shared/types/project.ts` | 追加（HttpMethod, HttpBodyType, HttpEndpoint） |
| `src/shared/types/ipc.ts` | 追加（HttpRequestParams, HttpResponse, IpcApi メソッド） |
| `src/preload/index.ts` | 追加（httpRequest の contextBridge 公開） |
| `src/renderer/src/env.d.ts` | 追加（window.reqstraApi.httpRequest 型） |
| `src/main/http/client.ts` | 新規 |
| `src/main/ipc/http.ts` | 新規 |
| `src/main/ipc/index.ts` | 変更（registerHttpHandlers 追加） |
| `src/renderer/src/components/MainPanel/HttpPanel/index.tsx` | 新規 |
| `src/renderer/src/components/MainPanel/HttpPanel/RequestEditor.tsx` | 新規 |
| `src/renderer/src/components/MainPanel/HttpPanel/ResponseViewer.tsx` | 新規 |
| `src/renderer/src/components/MainPanel/index.tsx` | 変更（HttpPanel 追加） |
| `src/renderer/src/components/Sidebar/CollectionTree.tsx` | 変更（HTTP 対応） |
| `src/renderer/src/components/modals/HttpEndpointModal.tsx` | 新規 |

---

## テスト方針

- `src/main/http/client.ts` の `buildUrl` / `executeHttpRequest` はユニットテストを TDD で実装
- `tests/main/http/client.test.ts` に配置
