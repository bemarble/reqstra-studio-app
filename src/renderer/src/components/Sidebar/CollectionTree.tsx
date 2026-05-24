import { useState } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useAppStore } from '../../store/appStore'
import type { Collection, GrpcEndpoint } from '../../../../shared/types/project'
import * as path from 'path'

export function CollectionTree(): JSX.Element {
  const project = useProjectStore((s) => s.project)
  const activeProtocol = useAppStore((s) => s.activeProtocol)
  const openTab = useAppStore((s) => s.openTab)
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set())
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<string>>(new Set())
  const [casesByEndpoint, setCasesByEndpoint] = useState<Record<string, string[]>>({})

  const collections = (project?.collections ?? []).filter(
    (c) => c.protocol === activeProtocol
  )

  const toggleCollection = (id: string): void => {
    setExpandedCollections((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleEndpoint = async (ep: GrpcEndpoint): Promise<void> => {
    if (!project) return
    const casesAbsDir = path.join(project.projectDir, ep.casesDir)

    if (!expandedEndpoints.has(ep.id)) {
      const cases = await window.reqstraApi.listCases(casesAbsDir)
      setCasesByEndpoint((prev) => ({ ...prev, [ep.id]: cases }))
    }

    setExpandedEndpoints((prev) => {
      const next = new Set(prev)
      next.has(ep.id) ? next.delete(ep.id) : next.add(ep.id)
      return next
    })
  }

  const handleCaseClick = (_col: Collection, ep: GrpcEndpoint, caseName: string): void => {
    openTab({
      id: `${ep.id}::${caseName}`,
      label: `${ep.name} / ${caseName.replace(/\.ya?ml$/, '')}`,
      endpointId: ep.id,
      caseName,
    })
  }

  return (
    <div className="flex-1 overflow-y-auto py-1 text-xs">
      {collections.length === 0 && (
        <p className="px-3 text-[var(--color-text-secondary)]">コレクションなし</p>
      )}
      {collections.map((col) => (
        <div key={col.id}>
          <button
            className="flex w-full items-center px-2 py-0.5 text-left text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
            onClick={() => toggleCollection(col.id)}
          >
            <span className="mr-1">{expandedCollections.has(col.id) ? '▾' : '▸'}</span>
            <span className="font-medium">{col.name}</span>
          </button>
          {expandedCollections.has(col.id) &&
            col.endpoints.map((ep) => (
              <div key={ep.id}>
                <button
                  className="flex w-full items-center py-0.5 pl-5 pr-2 text-left text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
                  onClick={() => toggleEndpoint(ep)}
                >
                  <span className="mr-1">{expandedEndpoints.has(ep.id) ? '▾' : '▸'}</span>
                  {ep.name}
                </button>
                {expandedEndpoints.has(ep.id) &&
                  (casesByEndpoint[ep.id] ?? []).map((caseName) => (
                    <button
                      key={caseName}
                      className="block w-full py-0.5 pl-10 pr-2 text-left text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-active)] hover:text-white"
                      onClick={() => handleCaseClick(col, ep, caseName)}
                    >
                      {caseName.replace(/\.ya?ml$/, '')}
                    </button>
                  ))}
              </div>
            ))}
        </div>
      ))}
    </div>
  )
}
