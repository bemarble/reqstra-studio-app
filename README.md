# Reqstra Studio

Mac向けデスクトップAPIクライアント。HTTP / gRPC / GraphQL の3プロトコルに対応。ローカル完結型（サーバー不要）。

## 機能

- gRPCリクエストの送信（サーバーリフレクション対応）
- GraphQLリクエストの送信（クエリ・Variables・Headers・Auth対応）
- リクエストパラメータをケース単位でYAMLファイルとして管理
- 複数の環境（dev / stg / prod）とターゲットをプロジェクトで一元管理
- VS Code風の3ペインUI（サイドバー・エディタ・レスポンスビューア）
- 複数ケースをタブで同時に開いて比較可能
- HTTPリクエストの送信（準備中）

---

### gRPC（実装済み）

- サーバーリフレクションを使ってエンドポイント一覧を自動取得
- リクエストボディをYAML（Monaco Editor）で編集し送信
- レスポンスはBody・ステータスコード・実行時間で確認できる
- gRPCメタデータ（ヘッダー）の設定にも対応

### GraphQL（実装済み）

- クエリはコレクション（クエリ名）単位で管理・自動保存
- Variables はケース単位で管理（`+` ボタンで `default` ケースを自動作成）
- Headers・Auth はコレクション単位で保持
- レスポンスを Body / Request Headers / Response Headers のタブで確認
- Introspect（スキーマ取得）に対応
- 下部ステータスバーに保存状態（対象名・保存中/済）を表示

#### GraphQL 操作フロー

1. サイドバー上部の `＋` でコレクション（クエリ）を追加
2. コレクション行の `＋` を押すと `default` ケースが作成され、エディタが開く
3. Query エディタにクエリを入力 → 自動保存（800ms デバウンス）
4. Variables タブにJSONを入力 → ケースファイルに自動保存
5. Headers / Auth タブで認証情報を設定 → コレクション単位で自動保存
6. `▶ Send` でリクエスト送信、レスポンスを右ペインで確認

### HTTP（準備中）

---

## インストール

**動作環境:** macOS（Apple Silicon / Intel）

[GitHub Releases](https://github.com/bemarble/reqstra-studio/releases) から最新の `.dmg` をダウンロードしてインストールしてください。

> 現在リリースビルドの配布準備中です。

---

## 開発者向けセットアップ

### 必要環境

- Node.js 20+
- npm

### 起動手順

```bash
npm install
npm run dev
```

### コマンド一覧

| コマンド | 説明 |
|---|---|
| `npm run dev` | 開発サーバー起動（Electron + Vite HMR） |
| `npm run build` | プロダクションビルド |
| `npm run test` | 全テスト実行 |
| `npm run test -- --project main` | Main Processのテストのみ |
| `npm run test -- --project renderer` | Rendererのテストのみ |

---

## データモデル

### プロジェクト構造

```
my-project/
├── reqstra-project.json        # プロジェクト定義（環境・コレクション・クエリ）
├── requests/
│   ├── grpc/ServiceName/MethodName/
│   │   └── CaseA.yaml          # gRPCリクエストボディ
│   └── graphql/QueryName/
│       └── default.yaml        # GraphQL Variables（JSONオブジェクト）
└── logs/
    └── YYYY-MM-DD.ndjson       # 実行ログ（追記形式）
```

### GraphQL データの保存場所

| データ | 保存場所 |
|---|---|
| クエリ文字列・Headers・Auth | `reqstra-project.json`（コレクション単位） |
| Variables | `requests/graphql/{QueryName}/*.yaml`（ケース単位） |

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フレームワーク | Electron + electron-vite |
| UI | React 18 + TypeScript |
| 状態管理 | Zustand |
| コードエディタ | Monaco Editor (@monaco-editor/react) |
| スタイリング | TailwindCSS |
| gRPC | @grpc/grpc-js + @grpc/proto-loader |
| gRPCリフレクション | grpc-js-reflection-client |
| GraphQL | graphql + graphql-request |
| YAMLパーサー | yaml |
| テスト | vitest + @testing-library/react |

---

## コントリビュート

開発に参加する場合は [CLAUDE.md](./CLAUDE.md) を参照してください。
