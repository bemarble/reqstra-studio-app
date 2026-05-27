import { useState, type JSX } from 'react'
import type { Collection, HttpEndpoint, HttpMethod, HttpBodyType, HttpTarget, Environment } from '../../../../shared/types/project'

interface Props {
  mode: 'add' | 'edit'
  initial?: Collection
  environment: Environment | undefined
  onSubmit: (col: Collection) => void
  onClose: () => void
  isSubmitting?: boolean
}

function getTargets(environment: Environment | undefined): HttpTarget[] {
  return environment?.protocols.http ?? []
}

export function HttpEndpointModal({
  mode,
  initial,
  environment,
  onSubmit,
  onClose,
  isSubmitting,
}: Props): JSX.Element {
  const existingEndpoint = initial?.endpoints[0] as HttpEndpoint | undefined
  const httpTargets = getTargets(environment)

  const [name, setName] = useState<string>(initial?.name ?? '')
  const [protocolTargetId, setProtocolTargetId] = useState<string>(
    initial?.protocolTargetId ?? httpTargets[0]?.id ?? '',
  )
  const [method, setMethod] = useState<HttpMethod>(existingEndpoint?.method ?? 'GET')
  const [path, setPath] = useState<string>(existingEndpoint?.path ?? '/')
  const [bodyType, setBodyType] = useState<HttpBodyType>(existingEndpoint?.bodyType ?? 'json')

  const isValid = name.trim().length > 0 && path.trim().length > 0

  const handleSubmit = (): void => {
    if (!isValid) return
    const trimmedName = name.trim()
    const endpoint: HttpEndpoint = {
      id: existingEndpoint?.id ?? crypto.randomUUID(),
      name: trimmedName,
      method,
      path: path.trim(),
      bodyType,
      casesDir: `requests/http/${trimmedName}`,
      headers: existingEndpoint?.headers,
      auth: existingEndpoint?.auth,
    }
    onSubmit({
      id: initial?.id ?? crypto.randomUUID(),
      protocol: 'http',
      name: trimmedName,
      protocolTargetId,
      endpoints: [endpoint],
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-96 rounded bg-[var(--color-bg-secondary)] p-4 shadow-xl">
        <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
          {mode === 'add' ? 'HTTP エンドポイントを追加' : 'HTTP エンドポイントを編集'}
        </h2>

        <div className="mb-3">
          <label htmlFor="http-name" className="mb-1 block text-xs text-[var(--color-text-secondary)]">
            名前
          </label>
          <input
            id="http-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            placeholder="例: Create User"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            className="w-full rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-accent)]"
          />
        </div>

        <div className="mb-3">
          <label htmlFor="http-target" className="mb-1 block text-xs text-[var(--color-text-secondary)]">
            ターゲット
          </label>
          <select
            id="http-target"
            value={protocolTargetId}
            onChange={(e) => setProtocolTargetId(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none"
          >
            {httpTargets.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
            {httpTargets.length === 0 && <option value="">ターゲット未設定</option>}
          </select>
        </div>

        <div className="mb-3 flex gap-2">
          <div className="w-28">
            <label htmlFor="http-method" className="mb-1 block text-xs text-[var(--color-text-secondary)]">
              メソッド
            </label>
            <select
              id="http-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as HttpMethod)}
              className="w-full rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none"
            >
              {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as HttpMethod[]).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label htmlFor="http-path" className="mb-1 block text-xs text-[var(--color-text-secondary)]">
              パス
            </label>
            <input
              id="http-path"
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/users/:id"
              className="w-full rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-accent)]"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
            ボディタイプ
          </label>
          <div className="flex gap-3">
            {(['json', 'query', 'none'] as HttpBodyType[]).map((bt) => (
              <label key={bt} className="flex cursor-pointer items-center gap-1.5 text-xs text-[var(--color-text-primary)]">
                <input
                  type="radio"
                  value={bt}
                  checked={bodyType === bt}
                  onChange={() => setBodyType(bt)}
                  className="accent-[var(--color-text-accent)]"
                />
                {bt === 'json' ? 'JSON' : bt === 'query' ? 'Query Params' : 'None'}
              </label>
            ))}
          </div>
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
