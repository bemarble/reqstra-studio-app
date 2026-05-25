import type { JSX } from 'react'
import { ActivityBar } from './components/ActivityBar'
import { Sidebar } from './components/Sidebar'
import { MainPanel } from './components/MainPanel'
import { ResizablePanes } from './components/shared/ResizablePanes'
import { useProjectStore } from './store/projectStore'

export default function App(): JSX.Element {
  const project = useProjectStore((s) => s.project)
  const setProject = useProjectStore((s) => s.setProject)
  const setActiveCaseDirs = useProjectStore((s) => s.setActiveCaseDirs)

  const handleOpenProject = async (): Promise<void> => {
    const result = await window.reqstraApi.openProject()
    if (result) {
      setProject(result)
      const dirs = await window.reqstraApi.scanCaseDirs(result.projectDir)
      setActiveCaseDirs(dirs)
    }
  }

  if (!project) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-[var(--color-bg-primary)]">
        <div
          className="h-8 w-full flex-shrink-0 bg-[#333333]"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h1 className="mb-2 text-2xl font-bold text-[var(--color-text-accent)]">Reqstra Studio</h1>
            <p className="mb-6 text-[var(--color-text-secondary)]">API通信クライアント</p>
            <button
              onClick={handleOpenProject}
              className="rounded bg-[#0e639c] px-6 py-2 text-white hover:bg-[#1177bb]"
            >
              プロジェクトを開く
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--color-bg-primary)]">
      {/* macOS traffic lights (close/minimize/maximize) はここに重なる */}
      <div
        className="h-8 w-full flex-shrink-0 bg-[#333333]"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />
      <div className="flex flex-1 overflow-hidden">
        <ActivityBar />
        <ResizablePanes
          defaultLeftWidth={240}
          minLeft={160}
          minRight={400}
          storageKey="pane-sidebar-width"
        >
          <Sidebar />
          <MainPanel />
        </ResizablePanes>
      </div>
    </div>
  )
}
