# Reqstra Studio — 設計ドキュメント

**作成日**: 2026-05-25  
**ステータス**: 承認済み

---

## 概要

Reqstra Studio は Mac 向けのデスクトップ API クライアントアプリ。HTTP / gRPC / GraphQL の 3 プロトコルに対応し、エンドポイントとリクエストパラメータをプロジェクトフォルダ（JSON/YAML ファイル）で管理する。Electron ベースのローカル完結型アプリ。

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フレームワーク | Electron |
| UI | React + TypeScript |
| バンドラー | Vite |
| コードエディタ | Monaco Editor |
| 状態管理 | Zustand |
| gRPC | @grpc/grpc-js |
| HTTP | node-fetch |
| GraphQL | graphql-request |

---

## アーキテクチャ

```
┌─────────────────────────────────────┐
│         Renderer Process            │
│  React + TypeScript (UI層)          │
│  - VS Code風3ペインUI               │
│  - プロトコル別コンポーネント         │
│  - Zustandによる状態管理             │
└──────────────┬──────────────────────┘
               │ contextBridge (IPC)
               │ 型安全なAPI呼び出し
┌──────────────▼──────────────────────┐
│         Main Process                │
│  Node.js (ロジック層)               │
│  - gRPC: @grpc/grpc-js             │
│  - HTTP: node-fetch                │
│  - GraphQL: graphql-request        │
│  - ファイルI/O: プロジェクトJSON/YAML│
└──────────────┬──────────────────────┘
               │ ファイルシステム
┌──────────────▼──────────────────────┐
│  プロジェクトフォルダ                 │
│  reqstra-project.json              │
│  requests/ (パラメータYAML)         │
│  logs/ (実行ログNDJSON)             │
└─────────────────────────────────────┘
```

- UI（Renderer）と通信ロジック（Main）を完全分離
- IPC は contextBridge 経由で型安全に実装。Renderer から直接 Node.js モジュールは触れない
- サーバー不要。Electron アプリ単体でローカル完結

---

## UI 構成

VS Code 風のレイアウト。左端のアクティビティバーでプロトコルを切り替え、各プロトコルで 3 ペイン構成。

```
App
├── ActivityBar              # 左端：gRPC / GraphQL / HTTP 切り替え、環境設定
├── Sidebar
│   ├── EnvironmentSelector  # 環境切り替えドロップダウン
│   └── CollectionTree       # サービス → エンドポイント → ケース のツリー
│       └── ケースの追加・削除・名前変更
└── MainPanel
    ├── TabBar               # 複数ケースをタブで同時に開ける
    └── [プロトコル別パネル]
        ├── GrpcPanel
        │   ├── RequestEditor   # Monaco Editor（Raw body）
        │   ├── MetadataEditor  # gRPC メタデータ設定
        │   └── ResponseViewer  # Body / Status / 実行時間
        ├── GraphQLPanel
        │   ├── QueryEditor     # GraphQL クエリ入力（Monaco Editor）
        │   ├── VariablesEditor # Variables 入力
        │   └── ResponseViewer
        └── HttpPanel
            ├── UrlBar          # メソッド選択 + URL 入力
            ├── RequestEditor   # Body / Headers / Auth タブ
            └── ResponseViewer
```

---

## データモデル

### フォルダ構造

```
my-project/
├── reqstra-project.json          # プロジェクト定義（メタ情報・環境設定）
├── requests/
│   ├── grpc/
│   │   └── UserService/
│   │       └── GetUser/          # エンドポイント = ディレクトリ
│   │           ├── UserA.yaml    # ケースA（Raw body）
│   │           └── UserB.yaml    # ケースB（Raw body）
│   ├── graphql/
│   │   └── GetUser/
│   │       ├── UserA.yaml        # クエリ + Variables を含む
│   │       └── UserB.yaml
│   └── http/
│       └── CreateOrder/
│           ├── NormalOrder.yaml
│           └── BulkOrder.yaml
└── logs/
    └── 2026-05-25.ndjson         # 実行ログ（日付別・追記形式）
```

### reqstra-project.json

```json
{
  "name": "My API Project",
  "environments": [
    {
      "id": "dev",
      "name": "Development",
      "variables": { "host": "localhost:50051" }
    },
    {
      "id": "stg",
      "name": "Staging",
      "variables": { "host": "stg.example.com:50051" }
    }
  ],
  "collections": [
    {
      "id": "col-1",
      "protocol": "grpc",
      "name": "UserService",
      "config": {
        "host": "{{host}}",
        "secure": false
      },
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

### リクエストケースファイル（YAML・Raw body）

ファイルの内容をそのまま送信する。変換処理は行わない。

```yaml
# requests/grpc/UserService/GetUser/UserA.yaml
user_id: "alice-123"
include_deleted: false
```

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
```

### 実行ログ（NDJSON）

```jsonl
{"timestamp":"2026-05-25T10:00:00Z","protocol":"grpc","service":"UserService","method":"GetUser","case":"UserA","status":"OK","durationMs":43,"request":{"user_id":"alice-123"},"response":{"id":"alice-123","name":"Alice"}}
```

---

## プロトコル実装

### 実装優先順位

1. **gRPC**（Phase 1）
2. **GraphQL**（Phase 2）
3. **HTTP**（Phase 3）

### gRPC

- **サービス探索**: サーバーリフレクション（`@grpc/reflection`）でメソッド一覧を自動取得し、サイドバーのツリーに表示
- **セキュア/インセキュア**: コレクション設定の `secure: true/false` で切り替え
- **リクエスト実行**: YAML ファイルは実行時に JS オブジェクトへパースし `@grpc/grpc-js` に渡す。ファイル自体は YAML 文字列のまま保存（YAML→JSON への事前変換は行わない）
- **メタデータ**: キー/バリュー形式で設定可能

### GraphQL

- **クエリ入力**: Monaco Editor で GraphQL シンタックスハイライト
- **Variables**: YAML 形式で記述
- **スキーマ取得**: イントロスペクションで自動取得（エディタ補完に活用）

### HTTP

- **認証**: Bearer Token（ヘッダー自動付与）/ OAuth2（Authorization Code Flow）
- **リクエストボディ**: Raw body をそのまま送信。Content-Type はヘッダーで手動設定
- **メソッド**: GET / POST / PUT / PATCH / DELETE

---

## 共通機能

### 環境変数

- `{{variable_name}}` 形式で記述
- 実行時に選択中の環境の値に置換
- ホスト、ポート、トークン等に使用

### 実行ログ

- リクエスト・レスポンス・実行時間を `logs/YYYY-MM-DD.ndjson` に追記
- アプリ内のログビューアで閲覧可能（日付フィルタ対応）

### レスポンス表示

- Body: JSON pretty-print 表示（Monaco Editor でシンタックスハイライト）
- Headers: キー/バリューテーブル表示
- ステータス・実行時間をヘッダー部に表示
- ワンクリックでコピー可能

### Pretty フォーマット

- リクエストエディタ: フォーマットボタンで YAML/JSON を整形
- レスポンス: 常に pretty-print 表示

---

## 配布

- GitHub Releases で `.dmg` を配布
- Notarization は初期リリースでは行わない（ユーザーは右クリック→開く で起動）
- 将来的に Apple Developer Program 取得後に Notarization 対応

---

## スコープ外（将来対応）

- WebSocket / gRPC Streaming
- チーム共有・クラウド同期
- プラグイン機構
- Mac App Store 配布
