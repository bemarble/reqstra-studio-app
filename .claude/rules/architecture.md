# アーキテクチャルール

## Electron Main / Renderer の分離

- **Renderer から Node.js モジュールを直接 import しない**
  - `fs`, `path`（Node.js版）, `@grpc/grpc-js` 等はMain Processのみ
  - Renderer で `path` が必要な場合は `path-browserify` を使う（viteエイリアス設定済み）
- **すべての通信は `window.reqstraApi` 経由**
  - `src/preload/index.ts` で定義した contextBridge API のみ使う
  - 新しいIPC操作が必要になったら `src/shared/types/ipc.ts` に型を追加してから実装する

## 型の流れ

```
src/shared/types/project.ts  ← プロジェクトデータ型（Main/Renderer共用）
src/shared/types/ipc.ts      ← IPC API型・レスポンス型（Main/Renderer共用）
src/preload/index.ts         ← contextBridgeの実装
src/renderer/src/env.d.ts    ← window.reqstraApi の型宣言
```

- `shared/types/` 内のファイルはNode.js固有のモジュールをimportしない

## IPCハンドラーの追加手順

1. `src/shared/types/ipc.ts` の `IpcApi` インターフェースにメソッドを追加
2. `src/main/ipc/` に対応するハンドラーを実装
3. `src/main/ipc/index.ts` の `registerAllHandlers()` に登録
4. `src/preload/index.ts` の `api` オブジェクトに追加
