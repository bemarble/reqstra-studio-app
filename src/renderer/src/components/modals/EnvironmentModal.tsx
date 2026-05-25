import React, { useState, type JSX } from 'react'
import type { Environment } from '../../../../shared/types/project'

interface Props {
  mode: 'add' | 'edit'
  initial?: Environment
  onSubmit: (env: Environment) => void
  onDelete?: () => void
  onClose: () => void
  deleteWarning?: string
}

export function EnvironmentModal({ mode, initial, onSubmit, onDelete, onClose, deleteWarning }: Props): JSX.Element {
  const [name, setName] = useState<string>(initial?.name ?? '')

  const isValid = name.trim().length > 0

  const handleSubmit = (): void => {
    if (!isValid) return
    onSubmit({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      protocols: initial?.protocols ?? {},
    })
  }

  const handleDelete = (): void => {
    const message = deleteWarning
      ? `環境「${name}」を削除しますか？\n\n${deleteWarning}`
      : `環境「${name}」を削除しますか？`
    if (window.confirm(message)) {
      onDelete?.()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-80 rounded bg-[var(--color-bg-secondary)] p-4 shadow-xl">
        <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
          {mode === 'add' ? '環境を追加' : '環境を編集'}
        </h2>

        <div className="mb-4">
          <label htmlFor="env-name" className="mb-1 block text-xs text-[var(--color-text-secondary)]">名前</label>
          <input
            id="env-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: dev"
            autoFocus
            className="w-full rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-accent)]"
          />
        </div>

        {mode === 'edit' && onDelete && (
          <div className="mb-4">
            <button
              type="button"
              onClick={handleDelete}
              className="text-xs text-[var(--color-error)] hover:underline"
            >
              削除
            </button>
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
