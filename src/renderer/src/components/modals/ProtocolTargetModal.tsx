import React, { useState, type JSX } from 'react'
import type { GrpcTarget, HttpTarget, GraphQLTarget } from '../../../../shared/types/project'

interface Props {
  mode: 'add' | 'edit'
  protocol: 'grpc' | 'http' | 'graphql'
  initial?: GrpcTarget | HttpTarget | GraphQLTarget
  onSubmit: (target: GrpcTarget | HttpTarget | GraphQLTarget) => void
  onDelete?: () => void
  onClose: () => void
  isSubmitting?: boolean
}

const TITLES = {
  grpc: { add: 'gRPCターゲットを追加', edit: 'gRPCターゲットを編集' },
  http: { add: 'HTTPターゲットを追加', edit: 'HTTPターゲットを編集' },
  graphql: { add: 'GraphQLターゲットを追加', edit: 'GraphQLターゲットを編集' },
}

export function ProtocolTargetModal({ mode, protocol, initial, onSubmit, onDelete, onClose, isSubmitting }: Props): JSX.Element {
  const [name, setName] = useState<string>(initial?.name ?? '')
  const [host, setHost] = useState<string>(() => {
    if (protocol === 'grpc') return (initial as GrpcTarget | undefined)?.host ?? ''
    if (protocol === 'graphql') return (initial as GraphQLTarget | undefined)?.host ?? ''
    return ''
  })
  const [baseUrl, setBaseUrl] = useState<string>(() => {
    if (protocol === 'http') return (initial as HttpTarget | undefined)?.baseUrl ?? ''
    return ''
  })
  const [secure, setSecure] = useState<boolean>(() => {
    if (protocol === 'grpc') return (initial as GrpcTarget | undefined)?.secure ?? false
    return false
  })

  const isValid =
    name.trim().length > 0 &&
    (protocol === 'http' ? baseUrl.trim().length > 0 : host.trim().length > 0)

  const handleSubmit = (): void => {
    if (!isValid) return
    const id = initial?.id ?? crypto.randomUUID()
    if (protocol === 'grpc') {
      onSubmit({ id, name: name.trim(), host: host.trim(), secure } satisfies GrpcTarget)
    } else if (protocol === 'http') {
      onSubmit({ id, name: name.trim(), baseUrl: baseUrl.trim() } satisfies HttpTarget)
    } else {
      onSubmit({ id, name: name.trim(), host: host.trim() } satisfies GraphQLTarget)
    }
  }

  const handleDelete = (): void => {
    if (window.confirm(`ターゲット「${name}」を削除しますか？`)) {
      onDelete?.()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-80 rounded bg-[var(--color-bg-secondary)] p-4 shadow-xl">
        <h2 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
          {TITLES[protocol][mode]}
        </h2>

        <div className="mb-3">
          <label htmlFor="target-name" className="mb-1 block text-xs text-[var(--color-text-secondary)]">
            名前
          </label>
          <input
            id="target-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={protocol === 'grpc' ? '例: Local gRPC' : protocol === 'http' ? '例: REST API' : '例: GraphQL API'}
            autoFocus
            className="w-full rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-accent)]"
          />
        </div>

        {protocol !== 'http' && (
          <div className="mb-3">
            <label htmlFor="target-host" className="mb-1 block text-xs text-[var(--color-text-secondary)]">
              ホスト
            </label>
            <input
              id="target-host"
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder={protocol === 'grpc' ? '例: localhost:50051' : '例: http://localhost:4000/graphql'}
              className="w-full rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-accent)]"
            />
          </div>
        )}

        {protocol === 'http' && (
          <div className="mb-3">
            <label htmlFor="target-baseurl" className="mb-1 block text-xs text-[var(--color-text-secondary)]">
              Base URL
            </label>
            <input
              id="target-baseurl"
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="例: http://localhost:3000"
              className="w-full rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-accent)]"
            />
          </div>
        )}

        {protocol === 'grpc' && (
          <div className="mb-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="tls-secure"
              checked={secure}
              onChange={(e) => setSecure(e.target.checked)}
              className="cursor-pointer"
            />
            <label htmlFor="tls-secure" className="cursor-pointer text-xs text-[var(--color-text-primary)]">
              TLS (secure)
            </label>
          </div>
        )}

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
