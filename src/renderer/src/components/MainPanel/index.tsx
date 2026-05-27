import type { JSX } from 'react'
import { useAppStore } from '../../store/appStore'
import { TabBar } from './TabBar'
import { GrpcPanel } from './GrpcPanel'
import { GraphQLPanel } from './GraphQLPanel'
import { HttpPanel } from './HttpPanel'

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
            <p className="text-sm">サイドバーからエンドポイントまたはケースを選択してください</p>
          </div>
        )}
        {activeTab && activeProtocol === 'grpc' && (
          <GrpcPanel key={activeTab.id} tab={activeTab} />
        )}
        {activeTab && activeProtocol === 'graphql' && (
          <GraphQLPanel key={activeTab.id} tab={activeTab} />
        )}
        {activeTab && activeProtocol === 'http' && (
          <HttpPanel key={activeTab.id} tab={activeTab} />
        )}
      </div>
    </div>
  )
}
