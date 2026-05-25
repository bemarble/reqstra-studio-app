# Git ルール

## ブランチ

- `main` に直接コミットしない
- 機能ブランチ: `feat/feature-name`
- バグ修正: `fix/bug-name`
- ドキュメント: `docs/topic`

## コミットメッセージ

Conventional Commits 形式。本文は日本語。

```
feat: gRPCサーバーリフレクションを実装
fix: YAMLパースエラー時にクラッシュする問題を修正
test: gRPCクライアントのユニットテストを追加
refactor: IPCハンドラーをプロトコル別に分割
```

## コミット粒度

- テストを書いたらコミット
- 実装が通ったらコミット
- まとめてコミットしない

## 禁止

- `--no-verify` でフックをスキップしない
- セキュアな情報（APIキー、トークン等）をコミットしない
- `git push --force` を main に対して行わない
- 確認なしに自動コミット・自動pushしない
