# テストルール

## TDD を徹底する

Main Processのビジネスロジックは必ずテストファーストで実装する。

```
1. テストを書く（失敗することを確認）
2. 最小限の実装をする（テストが通ることを確認）
3. コミットする
```

## テスト環境

| 対象 | 場所 | 環境 | コマンド |
|---|---|---|---|
| Main Process | `tests/main/` | node | `npm run test -- --project main` |
| Renderer | `tests/renderer/` | jsdom | `npm run test -- --project renderer` |

## ファイル対応

```
src/main/ipc/project.ts   →  tests/main/ipc/project.test.ts
src/main/ipc/log.ts       →  tests/main/ipc/log.test.ts
src/main/grpc/reflection.ts → tests/main/grpc/reflection.test.ts
src/main/grpc/client.ts   →  tests/main/grpc/client.test.ts
```

## UIコンポーネントのテスト対象

Zustand ストアのロジックは優先的にテストする。コンポーネント描画のテストはスナップショットではなくユーザー操作に基づいたテストを書く。

## 禁止事項

- テストをコメントアウト・削除しない（修正して通す）
- `vi.mock` でファイルシステムをモックしない（tmpディレクトリを使う）
- 実際に失敗することを確認せずにテストを「書いた」と見なさない
