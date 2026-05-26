import { type JSX } from 'react'
import { MonacoEditor } from '../../shared/MonacoEditor'
import type { GraphQLResponse } from '../../../../../shared/types/ipc'

interface Props {
  response: GraphQLResponse | null
  isLoading: boolean
}

export function ResponseViewer({ response, isLoading }: Props): JSX.Element {
  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-[var(--color-text-secondary)]">
        <span className="animate-pulse">送信中...</span>
      </div>
    )
  }

  if (!response) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center text-xs text-[var(--color-text-secondary)]">
        レスポンスなし
      </div>
    )
  }

  const bodyString =
    JSON.stringify(
      response.errors.length > 0 ? { data: response.data, errors: response.errors } : response.data,
      null,
      2,
    ) ?? ''

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-3 py-1">
        <span
          className={`text-xs font-medium ${
            response.status === 'OK' ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'
          }`}
        >
          ● {response.status}
          {response.httpStatus > 0 && (
            <span className="ml-2 text-[var(--color-text-secondary)]">HTTP {response.httpStatus}</span>
          )}
        </span>
        <span className="text-xs text-[var(--color-text-secondary)]">{response.durationMs}ms</span>
      </div>
      {response.error && (
        <div className="shrink-0 border-b border-[var(--color-border)] bg-[#2d1515] px-3 py-2 text-xs text-[var(--color-error)]">
          {response.error}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-hidden">
        <MonacoEditor value={bodyString} language="json" readOnly />
      </div>
    </div>
  )
}
