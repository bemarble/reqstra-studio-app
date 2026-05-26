# Reqstra Studio

Mac向けデスクトップAPIクライアント。HTTP / gRPC / GraphQL の3プロトコルに対応。ローカル完結型（サーバー不要）。

## 機能

### 概要

- gRPCリクエストの送信（サーバーリフレクション対応・実装済み）
- リクエストパラメータをケース単位でYAMLファイルとして管理
- 複数の環境（dev / stg / prod）とターゲットをプロジェクトで一元管理
- VS Code風の3ペインUI（サイドバー・エディタ・レスポンスビューア）
- 複数ケースをタブで同時に開いて比較可能
- GraphQL / HTTPリクエストの送信（準備中）

### gRPC（実装済み）

- サーバーリフレクションを使ってエンドポイント一覧を自動取得
- リクエストボディをYAML（Monaco Editor）で編集し送信
- レスポンスはBody・ステータスコード・実行時間で確認できる
- gRPCメタデータ（ヘッダー）の設定にも対応

### GraphQL（準備中）

クエリとVariablesを入力してリクエストを送信する予定。

### HTTP（準備中）

メソッド・URL・ヘッダー・ボディを指定してリクエストを送信する予定。

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
| YAMLパーサー | yaml |
| テスト | vitest + @testing-library/react |

---

## コントリビュート

開発に参加する場合は [CLAUDE.md](./CLAUDE.md) を参照してください。
