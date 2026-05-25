import type { JSX } from 'react'
import { useAppStore, type Protocol } from '../store/appStore'

const PROTOCOLS: { id: Protocol; label: string; icon: string }[] = [
  { id: 'grpc', label: 'gRPC', icon: '⚡' },
  { id: 'graphql', label: 'GraphQL', icon: '◈' },
  { id: 'http', label: 'HTTP', icon: '🌐' },
]

export function ActivityBar(): JSX.Element {
  const activeProtocol = useAppStore((s) => s.activeProtocol)
  const setActiveProtocol = useAppStore((s) => s.setActiveProtocol)

  return (
    <div className="flex w-12 flex-col items-center border-r border-[var(--color-border)] bg-[#333333] py-2">
      {PROTOCOLS.map((p) => (
        <button
          key={p.id}
          title={p.label}
          onClick={() => setActiveProtocol(p.id)}
          className={`mb-1 flex h-10 w-10 items-center justify-center rounded text-lg transition-colors ${
            activeProtocol === p.id
              ? 'text-white'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
          style={activeProtocol === p.id ? { borderLeft: '2px solid #4fc1ff' } : {}}
        >
          {p.icon}
        </button>
      ))}
      <div className="flex-1" />
      <button className="mb-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]" title="設定">
        ⚙
      </button>
    </div>
  )
}
