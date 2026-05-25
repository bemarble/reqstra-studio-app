import type { JSX } from 'react'
import { ActivityBar } from './components/ActivityBar'
import { Sidebar } from './components/Sidebar'
import { MainPanel } from './components/MainPanel'
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
      <div className="flex h-screen items-center justify-center bg-[var(--color-bg-primary)]">
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
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg-primary)]">
      <ActivityBar />
      <Sidebar />
      <MainPanel />
    </div>
  )
}
