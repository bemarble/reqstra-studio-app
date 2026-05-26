import type { JSX } from 'react'
import { useAppStore } from '../store/appStore'
import { useProjectStore } from '../store/projectStore'

export function StatusBar(): JSX.Element {
  const project = useProjectStore((s) => s.project)
  const saveStatus = useAppStore((s) => s.saveStatus)

  return (
    <div className="flex h-6 items-center gap-3 border-t border-[var(--color-border)] bg-[#007acc] px-3 text-xs text-white">
      {project && (
        <span className="truncate opacity-80">{project.name}</span>
      )}
      <span className="flex-1" />
      {saveStatus === 'saving' && (
        <span className="opacity-80">保存中...</span>
      )}
      {saveStatus === 'saved' && (
        <span className="opacity-80">保存済み</span>
      )}
    </div>
  )
}
