# Reqstra Studio

Mac向けデスクトップAPIクライアント。HTTP / gRPC / GraphQL の3プロトコルに対応。ローカル完結型（サーバー不要）。

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
