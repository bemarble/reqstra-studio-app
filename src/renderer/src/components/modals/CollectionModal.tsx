import React, { useState, type JSX } from 'react'
import type { Collection, Environment } from '../../../../shared/types/project'

interface Props {
  mode: 'add' | 'edit'
  initial?: Collection
  environment: Environment | undefined
  onSubmit: (col: Collection) => void
  onClose: () => void
}

const PROTOCOL_LABELS = { grpc: 'gRPC', http: 'HTTP', graphql: 'GraphQL' }

export function CollectionModal({ mode, initial, environment, onSubmit, onClose }: Props): JSX.Element {
  const [name, setName] = useState<string>(initial?.name ?? '')
  const [protocol, setProtocol] = useState<'grpc' | 'http' | 'graphql'>(initial?.protocol ?? 'grpc')
  const availableTargets =
    (environment?.protocols[protocol] as Array<{ id: string; name: string }> | undefined) ?? []
  const [protocolTargetId, setProtocolTargetId] = useState<string>(
    initial?.protocolTargetId ?? availableTargets[0]?.id ?? '',
  )

  const handleProtocolChange = (next: 'grpc' | 'http' | 'graphql'): void => {
    setProtocol(next)
    const targets =
      (environment?.protocols[next] as Array<{ id: string; name: string }> | undefined) ?? []
    setProtocolTargetId(targets[0]?.id ?? '')
  }

  const currentTargets =
    (environment?.protocols[protocol] as Array<{ id: string; name: string }> | undefined) ?? []

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
          {mode === 'add' ? 'コレクションを追加' : 'コレクションを編集'}
        </h2>

        <div className="mb-3">
          <label htmlFor="col-name" className="mb-1 block text-xs text-[var(--color-text-secondary)]">名前</label>
          <input
            id="col-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: UserService"
            autoFocus
            className="w-full rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-accent)]"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="col-protocol" className="mb-1 block text-xs text-[var(--color-text-secondary)]">プロトコル</label>
          <select
            id="col-protocol"
            value={protocol}
            onChange={(e) => handleProtocolChange(e.target.value as 'grpc' | 'http' | 'graphql')}
            disabled={mode === 'edit'}
            className="w-full rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none disabled:opacity-60"
          >
            {(['grpc', 'http', 'graphql'] as const).map((p) => (
              <option key={p} value={p}>
                {PROTOCOL_LABELS[p]}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label htmlFor="col-target" className="mb-1 block text-xs text-[var(--color-text-secondary)]">ターゲット</label>
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
            {currentTargets.length === 0 && <option value="">ターゲット未設定</option>}
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
            disabled={!isValid}
            className="rounded bg-[var(--color-bg-active)] px-3 py-1 text-xs text-white disabled:opacity-50"
          >
            {mode === 'add' ? '追加' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
