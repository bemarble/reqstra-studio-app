import type { JSX } from 'react'
import { useAppStore } from '../../store/appStore'
import { TabBar } from './TabBar'
import { GrpcPanel } from './GrpcPanel'

export function MainPanel(): JSX.Element {
  const openTabs = useAppStore((s) => s.openTabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const activeProtocol = useAppStore((s) => s.activeProtocol)

  const activeTab = openTabs.find((t) => t.id === activeTabId)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TabBar />
      <div className="flex-1 overflow-hidden">
        {!activeTab && (
          <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">
            <p className="text-sm">サイドバーからケースを選択してください</p>
          </div>
        )}
        {activeTab && activeProtocol === 'grpc' && (
          <GrpcPanel key={activeTab.id} tab={activeTab} />
        )}
        {activeTab && activeProtocol !== 'grpc' && (
          <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">
            <p className="text-sm">{activeProtocol.toUpperCase()} は次フェーズで実装予定</p>
          </div>
        )}
      </div>
    </div>
  )
}
