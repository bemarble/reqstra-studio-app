# TypeScript ルール

## 型

- `any` は使わない。`unknown` を使って型ガードで絞り込む
- `as unknown as X` のダブルキャストは最終手段。使う場合はコメントで理由を書く
- `@ts-expect-error` を使う場合は必ずコメントで理由を書く
- Reactコンポーネントの戻り値は `JSX.Element` を明示する

## 命名

- コンポーネント: PascalCase（`GrpcPanel`, `ActivityBar`）
- ストア: `use` + PascalCase（`useAppStore`, `useProjectStore`）
- IPC チャンネル名: `domain:action` 形式（`grpc:reflect`, `project:open`）
- ファイル名: コンポーネントは PascalCase、ユーティリティは camelCase

## React

- `useState` の型引数を省略しない（`useState<string>('')`）
- `useEffect` の依存配列を省略しない
- イベントハンドラは `handle` プレフィックス（`handleSend`, `handleBodyChange`）
- 非同期ハンドラは `(): Promise<void>` を明示する

## エラーハンドリング

- Main Process: エラーをcatchして `status: 'ERROR'` + `error: string` の形で返す
- Renderer: エラーはユーザーに見える形で表示する（コンソール出力のみにしない）
- `catch (e)` では `e instanceof Error ? e.message : String(e)` で安全にメッセージを取得する
