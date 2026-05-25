import React, { useState, useMemo } from 'react'
import type { JSX } from 'react'
import type { GrpcEndpoint } from '../../../../shared/types/project'

interface Props {
  mode: 'add' | 'edit'
  protocol: 'grpc' | 'http' | 'graphql'
  initial?: GrpcEndpoint
  onSubmit: (ep: GrpcEndpoint) => void
  onClose: () => void
}

export function EndpointModal({ mode, protocol, initial, onSubmit, onClose }: Props): JSX.Element {
  const [name, setName] = useState<string>(initial?.name ?? '')
  const [method, setMethod] = useState<string>(initial?.method ?? '')

  const casesDir = useMemo<string>(() => {
    if (!method.trim()) return ''
    return `requests/${protocol}/${method.trim()}`
  }, [method, protocol])

  const isValid = name.trim().length > 0 && method.trim().length > 0

  const handleSubmit = (): void => {
    if (!isValid) return
    onSubmit({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      method: method.trim(),
      casesDir,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-80 rounded bg-[var(--color-bg-secondary)] p-4 shadow-xl">
        <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
          {mode === 'add' ? 'エンドポイントを追加' : 'エンドポイントを編集'}
        </h2>

        <div className="mb-3">
          <label htmlFor="ep-name" className="mb-1 block text-xs text-[var(--color-text-secondary)]">名前</label>
          <input
            id="ep-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: GetUser"
            autoFocus
            className="w-full rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-accent)]"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="ep-method" className="mb-1 block text-xs text-[var(--color-text-secondary)]">メソッド</label>
          <input
            id="ep-method"
            type="text"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            placeholder="例: UserService/GetUser"
            className="w-full rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-accent)]"
          />
        </div>

        {casesDir && (
          <div className="mb-4">
            <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
              ケースディレクトリ（自動生成）
            </label>
            <p className="font-mono text-xs text-[var(--color-text-secondary)]">{casesDir}</p>
          </div>
        )}

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
