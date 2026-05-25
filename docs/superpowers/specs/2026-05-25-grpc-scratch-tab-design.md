# gRPC スクラッチタブ設計

## 概要

RPC エンドポイントをクリックするだけで、ケースファイルを事前作成せずに gRPC リクエストを送信できる「スクラッチモード」を追加する。proto スキーマから JSON テンプレートを自動生成し、エディタに表示する。入力値は任意のタイミングで保存でき、次回以降ケースとして再利用できる。

---

## フロー

```
CollectionTree: エンドポイント名クリック
  → スクラッチタブを開く
  → grpcDescribeMethod IPC でJSONテンプレ取得
  → Monaco エディタに JSON テンプレ表示
  → ユーザーが値を編集
  → [Send] → grpcRequest IPC（既存）→ ResponseViewer に結果表示
  → [Save] → ケース名入力 → writeCase IPC → タブが case タブに変換
```

---

## データ型の変更

### Tab 型（`src/renderer/src/store/appStore.ts`）

```typescript
// 既存（caseベース）
type CaseTab = {
  type: 'case'
  id: string
  label: string
  endpointId: string
  caseName: string
}

// 新規（スクラッチ）
type ScratchTab = {
  type: 'scratch'
  id: string
  label: string
  endpointId: string
}

export type Tab = CaseTab | ScratchTab
```

後方互換のため、既存の `Tab` 型（`type` フィールドなし）を `CaseTab` に移行する。

タブの scratch → case 変換のために `appStore` に `replaceTab` アクションを追加する。

```typescript
replaceTab: (oldId: string, newTab: Tab) => void
// oldId のタブを newTab に置き換え、activeTabId も newTab.id に切り替える
```

### IPC API（`src/shared/types/ipc.ts`）

```typescript
// 追加
grpcDescribeMethod: (host: string, secure: boolean, method: string) => Promise<string>
// 戻り値: JSON テンプレ文字列（失敗時は空文字列 ""）
```

---

## Main Process

### `src/main/grpc/describe.ts`（新規）

`getDescriptorBySymbol` で取得したディスクリプタからリクエストメッセージのフィールドを再帰的に展開し、型ごとのデフォルト値を持つ JSON テンプレートを生成して返す。

型ごとのデフォルト値：

| proto 型 | JSON デフォルト |
|---|---|
| string | `""` |
| int32 / int64 / uint32 / uint64 | `0` |
| float / double | `0` |
| bool | `false` |
| message（ネスト） | `{}` として再帰展開 |
| repeated | `[]` |
| enum | `0` |

ディスクリプタ取得失敗時（サーバー未起動など）は空文字列 `""` を返す。

```typescript
export async function describeMethod(
  host: string,
  secure: boolean,
  method: string  // "ServiceName/MethodName"
): Promise<string>
```

### `src/main/ipc/grpc.ts`（変更）

```typescript
ipcMain.handle('grpc:describeMethod', async (_event, host, secure, method) => {
  return describeMethod(host, secure, method)
})
```

---

## Renderer

### CollectionTree（`src/renderer/src/components/Sidebar/CollectionTree.tsx`）

エンドポイント行のクリック動作を変更する。

- **変更前**: `toggleEndpoint(ep)` のみ（展開/折りたたみ）
- **変更後**: `toggleEndpoint(ep)` に加えてスクラッチタブを開く

```typescript
openTab({
  type: 'scratch',
  id: `scratch::${ep.id}`,  // 同じエンドポイントは1タブのみ
  label: ep.name,
  endpointId: ep.id,
})
```

### GrpcPanel（`src/renderer/src/components/MainPanel/GrpcPanel/index.tsx`）

`tab.type` によって初期化フローを分岐する。

**スクラッチタブ（type: 'scratch'）**:
- マウント時に `grpcDescribeMethod` を呼んでテンプレ取得
- Monaco エディタ（JSON モード）に表示
- テンプレ取得中は Monaco を `readOnly` で表示

**ケースタブ（type: 'case'）**:
- 従来どおりファイルを読み込み YAML モードで表示（既存動作を維持）

Send ボタンはどちらの tab 型でも共通の `handleSend` を使う。

### ツールバー（Save ボタン）

スクラッチタブのツールバーに Save ボタンを追加する。

```
[gRPC] GetUser                [Save]  [▶ Send]
```

Save クリック時:
1. ツールバー内にインライン入力欄が展開される（ケース名を入力）
2. 確定（Enter またはボタン）すると `writeCase` IPC で書き込み  
   - 保存先: `{projectDir}/{endpoint.casesDir}/{入力名}.yaml`（入力名に `.yaml` がなければ自動付与）
   - 内容: Monaco エディタの内容をそのまま保存（JSON は YAML の上位互換のため `parseYamlBody` で読み込み可能）
3. `replaceTab` でタブが scratch → case タブに変換される  
   - 新タブ: `{ type: 'case', id: '{endpointId}::{caseName}', caseName: '{入力名}.yaml', ... }`
4. CollectionTree の該当エンドポイントを展開すると新しいケースが表示される

---

## テスト方針

- `src/main/grpc/describe.ts` のユニットテストを `tests/main/grpc/describe.test.ts` に作成  
  - `grpc-js-reflection-client` をモックして各 proto 型のデフォルト値生成を検証
  - ネストされたメッセージの再帰展開を検証
  - `repeated` フィールドが `[]` になることを検証
  - 失敗時に空文字列を返すことを検証

---

## 既存コードへの影響

- `Tab` 型に `type` フィールドが必須になるため、既存の `openTab` 呼び出し（`CollectionTree` の `handleCaseClick`）を `type: 'case'` に移行する
- `GrpcPanel` の `useEffect`（ファイル読み込み）を `tab.type === 'case'` の条件付きに変更する
- 上記以外の既存動作は変更しない
