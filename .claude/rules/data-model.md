# データモデルルール

## リクエストケースファイル

- **Raw bodyとして保存する**（YAML→JSON変換を事前に行わない）
- gRPC: YAMLを実行時にJSオブジェクトへパースして `@grpc/grpc-js` に渡す
- HTTP: Raw文字列をそのまま送信する（Content-Typeはヘッダーで手動設定）
- GraphQL: YAMLから `query` と `variables` を実行時に抽出する

## ファイル形式

```
requests/grpc/ServiceName/MethodName/CaseName.yaml
```

- ケース名はファイル名から `.yaml` を除いたもの
- `casesDir` は `reqstra-project.json` からの相対パス
- 絶対パスへの変換: `path.join(project.projectDir, casesDir)`

## 環境とターゲット

- 環境（`environments`）は `reqstra-project.json` で定義する
- 各環境はプロトコルごとに複数のターゲットを持てる
- コレクションは `protocolTargetId` でターゲットを参照する
- 環境切り替え時は同じ `protocolTargetId` のターゲットに自動追従する

## 実行ログ

- `logs/YYYY-MM-DD.ndjson` に追記（1行1JSONオブジェクト）
- ログファイルはGit管理対象外（`.gitignore` に `logs/` を追加すること）
