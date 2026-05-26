import type { JSX } from 'react'
import { useAppStore } from '../../store/appStore'
import { EnvironmentSelector } from './EnvironmentSelector'
import { ProtocolTargetSelector } from './ProtocolTargetSelector'
import { CollectionTree } from './CollectionTree'

const PROTOCOL_LABELS = { grpc: 'GRPC EXPLORER', graphql: 'GRAPHQL EXPLORER', http: 'HTTP EXPLORER' }

export function Sidebar(): JSX.Element {
  const activeProtocol = useAppStore((s) => s.activeProtocol)

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)] px-2 py-1">
        <span className="text-xs text-[var(--color-text-secondary)]">
          {PROTOCOL_LABELS[activeProtocol]}
        </span>
      </div>
      <EnvironmentSelector />
      <ProtocolTargetSelector />
      <CollectionTree />
    </div>
  )
}
