import { useState, type JSX } from 'react'
import { MonacoEditor } from '../../shared/MonacoEditor'
import { MetadataEditor } from './MetadataEditor'
import type { Tab } from '../../../store/appStore'

type TabName = 'request' | 'metadata'

interface Props {
  tab: Tab
  body: string
  metadata: Record<string, string>
  language: string
  onBodyChange: (body: string) => void
  onMetadataChange: (metadata: Record<string, string>) => void
}

export function RequestEditor({ tab: _tab, body, metadata, language, onBodyChange, onMetadataChange }: Props): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabName>('request')

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-2 border-b border-[var(--color-border)] px-3 py-1 text-xs">
        {(['request', 'metadata'] as TabName[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={activeTab === t ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}
          >
            {t === 'request' ? 'Request' : 'Metadata'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {activeTab === 'request' && (
          <MonacoEditor value={body} onChange={(v) => onBodyChange(v ?? '')} language={language} />
        )}
        {activeTab === 'metadata' && (
          <MetadataEditor metadata={metadata} onChange={onMetadataChange} />
        )}
      </div>
    </div>
  )
}
