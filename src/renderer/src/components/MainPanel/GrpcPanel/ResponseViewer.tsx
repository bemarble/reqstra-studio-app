import { useState, type JSX } from 'react'
import { MonacoEditor } from '../../shared/MonacoEditor'
import type { GrpcResponse } from '../../../../../shared/types/ipc'

interface Props {
  response: GrpcResponse | null
  isLoading: boolean
}

type TabName = 'body' | 'trailers'

export function ResponseViewer({ response, isLoading }: Props): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabName>('body')

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">
        <span className="animate-pulse">送信中...</span>
      </div>
    )
  }

  if (!response) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)] text-xs">
        レスポンスなし
      </div>
    )
  }

  const bodyString = JSON.stringify(response.body, null, 2) ?? ''

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-1">
        <span
          className={`text-xs font-medium ${
            response.status === 'OK' ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'
          }`}
        >
          ● {response.status}
        </span>
        <span className="text-xs text-[var(--color-text-secondary)]">{response.durationMs}ms</span>
      </div>
      {response.status === 'ERROR' && (
        <div className="border-b border-[var(--color-border)] bg-[#2d1515] px-3 py-2 text-xs text-[var(--color-error)]">
          {response.error}
        </div>
      )}
      <div className="flex gap-2 border-b border-[var(--color-border)] px-3 py-1 text-xs">
        {(['body', 'trailers'] as TabName[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={activeTab === tab ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}
          >
            {tab === 'body' ? 'Body' : 'Trailers'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {activeTab === 'body' && (
          <MonacoEditor value={bodyString} language="json" readOnly />
        )}
        {activeTab === 'trailers' && (
          <div className="p-2 text-xs">
            {Object.entries(response.trailers).map(([k, v]) => (
              <div key={k} className="flex gap-4">
                <span className="text-[var(--color-text-accent)]">{k}</span>
                <span className="text-[var(--color-text-primary)]">{v}</span>
              </div>
            ))}
            {Object.keys(response.trailers).length === 0 && (
              <span className="text-[var(--color-text-secondary)]">なし</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
