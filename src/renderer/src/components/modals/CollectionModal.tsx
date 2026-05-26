import React, { useState, type JSX } from 'react'
import type { Collection, Environment } from '../../../../shared/types/project'

interface Props {
  mode: 'add' | 'edit'
  initial?: Collection
  activeProtocol: 'grpc' | 'http' | 'graphql'
  environment: Environment | undefined
  onSubmit: (col: Collection) => void
  onClose: () => void
  isSubmitting?: boolean
}

// EnvironmentProtocols の各プロパティは GrpcTarget[] | HttpTarget[] | GraphQLTarget[] 型だが
// id/name は共通で持つため共通型にキャストして使う
function getTargets(
  environment: Environment | undefined,
  protocol: 'grpc' | 'http' | 'graphql',
): Array<{ id: string; name: string }> {
  return (environment?.protocols[protocol] as Array<{ id: string; name: string }> | undefined) ?? []
}

export function CollectionModal({ mode, initial, activeProtocol, environment, onSubmit, onClose, isSubmitting }: Props): JSX.Element {
  const [name, setName] = useState<string>(initial?.name ?? '')
  const protocol = initial?.protocol ?? activeProtocol
  const currentTargets = getTargets(environment, protocol)
  const [protocolTargetId, setProtocolTargetId] = useState<string>(
    initial?.protocolTargetId ?? currentTargets[0]?.id ?? '',
  )

  const isValid = name.trim().length > 0

  const handleSubmit = (): void => {
    if (!isValid) return
    onSubmit({
      id: initial?.id ?? crypto.randomUUID(),
      protocol,
      name: name.trim(),
      protocolTargetId,
      endpoints: initial?.endpoints ?? [],
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-80 rounded bg-[var(--color-bg-secondary)] p-4 shadow-xl">
        <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
          {mode === 'add'
            ? protocol === 'graphql' ? 'クエリを追加' : 'コレクションを追加'
            : protocol === 'graphql' ? 'クエリを編集' : 'コレクションを編集'}
        </h2>

        <div className="mb-3">
          <label htmlFor="col-name" className="mb-1 block text-xs text-[var(--color-text-secondary)]">名前</label>
          <input
            id="col-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={protocol === 'graphql' ? '例: GetCountries' : '例: UserService'}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            className="w-full rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-accent)]"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="col-target" className="mb-1 block text-xs text-[var(--color-text-secondary)]">
            {protocol === 'graphql' ? 'エンドポイント' : 'ターゲット'}
          </label>
          <select
            id="col-target"
            value={protocolTargetId}
            onChange={(e) => setProtocolTargetId(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none"
          >
            {currentTargets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            {currentTargets.length === 0 && (
              <option value="">{protocol === 'graphql' ? 'エンドポイント未設定' : 'ターゲット未設定'}</option>
            )}
          </select>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-[#3c3c3c] px-3 py-1 text-xs text-[var(--color-text-primary)] hover:bg-[#4c4c4c]"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || !!isSubmitting}
            className="rounded bg-[var(--color-bg-active)] px-3 py-1 text-xs text-white disabled:opacity-50"
          >
            {mode === 'add' ? '追加' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
