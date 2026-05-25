# Reqstra Studio — プロジェクトガイド

## プロジェクト概要

Mac向けデスクトップAPIクライアント。HTTP / gRPC / GraphQL の3プロトコルに対応。  
Electronベースのローカル完結型アプリ。サーバー不要。

**設計ドキュメント:** `docs/superpowers/specs/2026-05-25-reqstra-studio-design.md`  
**実装計画 Phase 1:** `docs/superpowers/plans/2026-05-25-phase1-foundation-grpc.md`

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

## アーキテクチャの原則

### Main / Renderer の分離

```
Renderer (React UI)
    ↕ contextBridge (window.reqstraApi)
Main Process (Node.js)
    ↕ ファイルシステム / gRPC / HTTP / GraphQL
```

- **Renderer からは Node.js モジュールを直接 import しない**
- ネットワーク通信・ファイルI/OはすべてMain Processで行い、IPC経由でRendererに返す
- `src/preload/index.ts` がcontextBridgeでRendererに公開するAPIを定義する
- Renderer で `path` が必要な場合は `path-browserify` を使う（viteエイリアス設定済み）

### ファイル構成

```
src/
├── shared/types/     # Main/Renderer両方で使う型定義（Node.js非依存）
├── main/             # Electronメインプロセス（Node.js）
│   ├── ipc/          # IPCハンドラー
│   └── grpc/         # gRPC通信ロジック
├── preload/          # contextBridgeの定義
└── renderer/src/     # React UI
    ├── store/        # Zustandストア
    ├── components/   # Reactコンポーネント
    └── types/        # Renderer専用の型（env.d.ts等）
tests/
├── main/             # Main Process のユニットテスト（node環境）
└── renderer/         # Renderer のコンポーネントテスト（jsdom環境）
```

---

## データモデル

### プロジェクトファイル

```
my-project/
├── reqstra-project.json    # プロジェクト定義（メタ情報・環境・コレクション）
├── requests/
│   └── grpc/ServiceName/MethodName/
│       ├── CaseA.yaml      # リクエストパラメータ（Raw body。変換なしで保存）
│       └── CaseB.yaml
└── logs/
    └── YYYY-MM-DD.ndjson   # 実行ログ（追記形式）
```

### 環境とプロトコルターゲット

```json
{
  "environments": [{
    "id": "dev",
    "protocols": {
      "grpc": [
        { "id": "grpc-a", "name": "UserService", "host": "localhost:50051", "secure": false }
      ],
      "http": [
        { "id": "http-a", "name": "REST API", "baseUrl": "http://localhost:3000" }
      ]
    }
  }]
}
```

---

## 開発コマンド

```bash
npm run dev       # 開発サーバー起動（Electron + Vite HMR）
npm run build     # プロダクションビルド
npm run test      # 全テスト実行
npm run test -- --project main      # Main Processのテストのみ
npm run test -- --project renderer  # Rendererのテストのみ
```

---

## コーディングルール

### 型

- `any` は使わず `unknown` を使う
- `src/shared/types/project.ts` に定義された型を必ず使う
- IPC経由の引数・戻り値は `src/shared/types/ipc.ts` の型に従う

### Rendererコンポーネント

- 1ファイル1コンポーネントを原則とする
- コンポーネントの props はファイル内に `interface Props` で定義する
- グローバル状態は Zustand store 経由で読み書きする
- `window.reqstraApi` 経由でMain Processと通信する

### Main Process

- IPCハンドラーは `src/main/ipc/` にプロトコル別で分割する
- gRPCロジックは `src/main/grpc/` に分離する
- エラーは握りつぶさず `GrpcResponse.error` のように呼び出し元に伝える

### テスト

- Main Processのビジネスロジックは必ずvitest でユニットテストを書く
- TDD: テストを先に書いてから実装する
- `tests/main/` はnode環境、`tests/renderer/` はjsdom環境で実行される

---

## UIデザイン方針

VS Code ライクな Dark テーマ。CSSカスタムプロパティ（`--color-*`）を使って色を統一する。

```css
--color-bg-primary: #1e1e1e
--color-bg-secondary: #252526
--color-bg-tertiary: #2d2d30
--color-bg-active: #094771
--color-border: #333333
--color-text-primary: #cccccc
--color-text-secondary: #888888
--color-text-accent: #4fc1ff
--color-success: #3fb950
--color-error: #f85149
```

---

## 実装フェーズ

| フェーズ | 内容 | 状態 |
|---|---|---|
| Phase 1 | アプリ基盤 + gRPC | 計画済み |
| Phase 2 | GraphQL | 未着手 |
| Phase 3 | HTTP | 未着手 |
