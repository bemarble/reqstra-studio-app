# README 充実化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 空に近い README.md を、内部チームと外部OSSユーザーの両方が参照できる日本語のドキュメントに充実させる。

**Architecture:** README.md を1ファイルのみ編集する。概要・インストール・開発者向けセットアップ・技術スタック・コントリビュートの5セクション構成。既存の設計情報は `docs/superpowers/specs/` にあるため、READMEは最小限に絞る。

**Tech Stack:** Markdown のみ

---

### Task 1: README.md を書き換える

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 現在の README.md の内容を確認する**

```bash
cat README.md
```

期待される出力:
```
# reqstra-studio-app
```

- [ ] **Step 2: README.md を以下の内容で完全に置き換える**

`README.md` の内容を丸ごと以下に差し替える:

```markdown
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

\`\`\`bash
npm install
npm run dev
\`\`\`

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
```

- [ ] **Step 3: 内容を目視確認する**

```bash
cat README.md
```

以下の5セクションがすべて存在することを確認:
- `## インストール`
- `## 開発者向けセットアップ`
- `## 技術スタック`
- `## コントリビュート`

- [ ] **Step 4: コミットする**

```bash
git add README.md
git commit -m "docs: READMEを充実させる"
```
