import { useAppStore } from '../../store/appStore'

export function TabBar(): JSX.Element {
  const openTabs = useAppStore((s) => s.openTabs)
  const activeTabId = useAppStore((s) => s.activeTabId)
  const setActiveTabId = useAppStore((s) => s.setActiveTabId)
  const closeTab = useAppStore((s) => s.closeTab)

  return (
    <div className="flex border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
      {openTabs.map((tab) => (
        <div
          key={tab.id}
          className={`flex cursor-pointer items-center gap-2 border-r border-[var(--color-border)] px-3 py-1 text-xs ${
            activeTabId === tab.id
              ? 'bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
          }`}
          onClick={() => setActiveTabId(tab.id)}
        >
          <span>{tab.label}</span>
          <button
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            onClick={(e) => {
              e.stopPropagation()
              closeTab(tab.id)
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
