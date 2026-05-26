# README 機能説明セクション追加 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** READMEの概要直後に「機能」セクションを追加し、実装済み機能と計画中機能を概要箇条書き＋プロトコル別詳細の形で記述する。

**Architecture:** README.md の1行概要の直後に `## 機能` セクションを挿入する。既存セクション（インストール以降）はそのまま残す。Markdownのみの変更でテストは不要。

**Tech Stack:** Markdown のみ

---

### Task 1: README.md に機能説明セクションを追加する

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 現在の README.md の先頭部分を確認する**

```bash
head -10 /Users/mktkbys/Documents/workspace/reqstra-studio/README.md
```

期待される出力:
```
# Reqstra Studio

Mac向けデスクトップAPIクライアント。HTTP / gRPC / GraphQL の3プロトコルに対応。ローカル完結型（サーバー不要）。

---

## インストール
```

- [ ] **Step 2: README.md の `---\n\n## インストール` の直前に機能セクションを挿入する**

`README.md` の以下の文字列を:

```
---

## インストール
```

以下に置き換える:

```
## 機能

### 概要

- gRPCリクエストの送信（サーバーリフレクション対応）
- リクエストパラメータをケース単位でYAMLファイルとして管理
- 複数の環境（dev / stg / prod）とターゲットをプロジェクトで一元管理
- VS Code風の3ペインUI（サイドバー・エディタ・レスポンスビューア）
- 複数ケースをタブで同時に開いて比較可能
- GraphQL / HTTPリクエストの送信（準備中）

### gRPC（実装済み）

サーバーリフレクションを使ってエンドポイント一覧を自動取得。
リクエストボディをYAML（Monaco Editor）で編集し送信。
レスポンスはBody・ステータスコード・実行時間で確認できる。
gRPCメタデータ（ヘッダー）の設定にも対応。

### GraphQL（準備中）

クエリとVariablesを入力してリクエストを送信する予定。

### HTTP（準備中）

メソッド・URL・ヘッダー・ボディを指定してリクエストを送信する予定。

---

## インストール
```

- [ ] **Step 3: 挿入後の README.md の先頭40行を確認する**

```bash
head -40 /Users/mktkbys/Documents/workspace/reqstra-studio/README.md
```

以下の順序でセクションが存在することを確認:
1. `# Reqstra Studio`（タイトル）
2. 1行概要
3. `## 機能`
4. `### 概要`（箇条書き6項目）
5. `### gRPC（実装済み）`
6. `### GraphQL（準備中）`
7. `### HTTP（準備中）`
8. `## インストール`

- [ ] **Step 4: コミットする**

```bash
git -C /Users/mktkbys/Documents/workspace/reqstra-studio add README.md
git -C /Users/mktkbys/Documents/workspace/reqstra-studio commit -m "docs: READMEに機能説明セクションを追加する"
```
