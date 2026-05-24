import { useAppStore } from '../../store/appStore'
import { TabBar } from './TabBar'

export function MainPanel(): JSX.Element {
  const activeTabId = useAppStore((s) => s.activeTabId)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TabBar />
      <div className="flex-1 overflow-hidden">
        {!activeTabId && (
          <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">
            <p className="text-sm">サイドバーからケースを選択してください</p>
          </div>
        )}
        {/* Task 10でGrpcPanelを接続する */}
      </div>
    </div>
  )
}
