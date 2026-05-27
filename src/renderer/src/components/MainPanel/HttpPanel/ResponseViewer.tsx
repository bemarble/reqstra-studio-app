import { useState, type JSX } from 'react'
import { MonacoEditor } from '../../shared/MonacoEditor'
import type { HttpResponse } from '../../../../../shared/types/ipc'

interface Props {
  response: HttpResponse | null
  isLoading: boolean
}

type ResponseTab = 'body' | 'request-headers' | 'response-headers'

function HeadersTable({ headers }: { headers: Record<string, string> }): JSX.Element {
  const entries = Object.entries(headers)
  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-[var(--color-text-secondary)]">
        ヘッダーなし
      </div>
    )
  }
  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-[var(--color-bg-secondary)]">
          <tr className="border-b border-[var(--color-border)]">
            <th className="w-2/5 px-3 py-1.5 text-left font-medium text-[var(--color-text-secondary)]">Name</th>
            <th className="px-3 py-1.5 text-left font-medium text-[var(--color-text-secondary)]">Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]">
              <td className="px-3 py-1.5 font-mono text-[var(--color-text-accent)]">{key}</td>
              <td className="px-3 py-1.5 font-mono text-[var(--color-text-primary)] break-all">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function httpStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-[var(--color-success)]'
  if (status >= 400) return 'text-[var(--color-error)]'
  return 'text-[var(--color-text-secondary)]'
}

export function ResponseViewer({ response, isLoading }: Props): JSX.Element {
  const [activeTab, setActiveTab] = useState<ResponseTab>('body')

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">
        <span className="animate-pulse">送信中...</span>
      </div>
    )
  }

  if (!response) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-[var(--color-text-secondary)]">
        レスポンスなし
      </div>
    )
  }

  const isJson = (() => {
    try {
      JSON.parse(response.body)
      return true
    } catch {
      return false
    }
  })()

  const bodyForEditor = isJson
    ? JSON.stringify(JSON.parse(response.body) as unknown, null, 2)
    : response.body

  const tabs: { id: ResponseTab; label: string }[] = [
    { id: 'body', label: 'Body' },
    { id: 'request-headers', label: 'Request Headers' },
    { id: 'response-headers', label: 'Response Headers' },
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-1">
        <span
          className={`text-xs font-medium ${
            response.status === 'OK' ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'
          }`}
        >
          ●{' '}
          {response.httpStatus > 0 && (
            <span className={httpStatusColor(response.httpStatus)}>
              {response.httpStatus}
            </span>
          )}
          {response.httpStatus === 0 && response.status}
        </span>
        <span className="text-xs text-[var(--color-text-secondary)]">{response.durationMs}ms</span>
      </div>

      {response.error && (
        <div className="border-b border-[var(--color-border)] bg-[#2d1515] px-3 py-2 text-xs text-[var(--color-error)]">
          {response.error}
        </div>
      )}

      <div className="flex border-b border-[var(--color-border)] px-3 text-xs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`mr-4 py-1 ${
              activeTab === tab.id
                ? 'border-b-2 border-[var(--color-text-accent)] text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'body' && (
          <MonacoEditor
            value={bodyForEditor}
            language={isJson ? 'json' : 'plaintext'}
            readOnly
          />
        )}
        {activeTab === 'request-headers' && (
          <HeadersTable headers={response.requestHeaders ?? {}} />
        )}
        {activeTab === 'response-headers' && (
          <HeadersTable headers={response.responseHeaders ?? {}} />
        )}
      </div>
    </div>
  )
}
