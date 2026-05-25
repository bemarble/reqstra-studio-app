import { useState, type JSX } from 'react'

interface Props {
  metadata: Record<string, string>
  onChange: (metadata: Record<string, string>) => void
}

export function MetadataEditor({ metadata, onChange }: Props): JSX.Element {
  const [newKey, setNewKey] = useState<string>('')
  const [newValue, setNewValue] = useState<string>('')

  const handleAdd = (): void => {
    if (!newKey.trim()) return
    onChange({ ...metadata, [newKey.trim()]: newValue })
    setNewKey('')
    setNewValue('')
  }

  const handleRemove = (key: string): void => {
    const next = { ...metadata }
    delete next[key]
    onChange(next)
  }

  const handleKeyChange = (oldKey: string, nextKey: string): void => {
    if (oldKey === nextKey) return
    const next: Record<string, string> = {}
    for (const [k, v] of Object.entries(metadata)) {
      next[k === oldKey ? nextKey : k] = v
    }
    onChange(next)
  }

  const handleValueChange = (key: string, value: string): void => {
    onChange({ ...metadata, [key]: value })
  }

  return (
    <div className="p-2 text-xs">
      <div className="mb-2 space-y-1">
        {Object.entries(metadata).map(([k, v], index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={k}
              onChange={(e) => handleKeyChange(k, e.target.value)}
              className="flex-1 rounded bg-[#3c3c3c] px-2 py-0.5 text-[var(--color-text-accent)] outline-none focus:ring-1 focus:ring-[var(--color-text-accent)]"
            />
            <input
              value={v}
              onChange={(e) => handleValueChange(k, e.target.value)}
              className="flex-1 rounded bg-[#3c3c3c] px-2 py-0.5 text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-[var(--color-text-accent)]"
            />
            <button
              onClick={() => handleRemove(k)}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-error)]"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          placeholder="Key"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          className="flex-1 rounded bg-[#3c3c3c] px-2 py-1 text-[var(--color-text-primary)] outline-none"
        />
        <input
          placeholder="Value"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          className="flex-1 rounded bg-[#3c3c3c] px-2 py-1 text-[var(--color-text-primary)] outline-none"
        />
        <button
          onClick={handleAdd}
          className="rounded bg-[#0e639c] px-3 py-1 text-white hover:bg-[#1177bb]"
        >
          追加
        </button>
      </div>
    </div>
  )
}
