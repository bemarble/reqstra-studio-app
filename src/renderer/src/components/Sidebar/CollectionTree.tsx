import { useState, type JSX } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useAppStore } from '../../store/appStore'
import type { Collection, GrpcEndpoint, GrpcTarget } from '../../../../shared/types/project'
import { CollectionModal } from '../modals/CollectionModal'
import { EndpointModal } from '../modals/EndpointModal'
import * as path from 'path'

type ModalState =
  | { type: 'add-collection' }
  | { type: 'edit-collection'; collection: Collection }
  | { type: 'add-endpoint'; collectionId: string }
  | { type: 'edit-endpoint'; collectionId: string; endpoint: GrpcEndpoint }
  | null

export function CollectionTree(): JSX.Element {
  const project = useProjectStore((s) => s.project)
  const addCollection = useProjectStore((s) => s.addCollection)
  const updateCollection = useProjectStore((s) => s.updateCollection)
  const deleteCollection = useProjectStore((s) => s.deleteCollection)
  const addEndpoint = useProjectStore((s) => s.addEndpoint)
  const updateEndpoint = useProjectStore((s) => s.updateEndpoint)
  const deleteEndpoint = useProjectStore((s) => s.deleteEndpoint)
  const activeProtocol = useAppStore((s) => s.activeProtocol)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const activeProtocolTargetId = useAppStore((s) => s.activeProtocolTargetId)
  const openTab = useAppStore((s) => s.openTab)

  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set())
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<string>>(new Set())
  const [casesByEndpoint, setCasesByEndpoint] = useState<Record<string, string[]>>({})
  const [modalState, setModalState] = useState<ModalState>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [isReflecting, setIsReflecting] = useState<boolean>(false)
  const [reflectError, setReflectError] = useState<string | null>(null)

  const collections = (project?.collections ?? []).filter((c) => c.protocol === activeProtocol)
  const activeEnv =
    project?.environments.find((e) => e.id === activeEnvironmentId) ?? project?.environments[0]

  const persistProject = async (): Promise<boolean> => {
    const p = useProjectStore.getState().project
    if (!p) return false
    try {
      await window.reqstraApi.saveProject(p)
      setSaveError(null)
      return true
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
      return false
    }
  }

  const handleReflect = async (): Promise<void> => {
    const grpcTargets = (activeEnv?.protocols?.grpc as GrpcTarget[] | undefined) ?? []
    const activeTarget =
      grpcTargets.find((t) => t.id === activeProtocolTargetId) ?? grpcTargets[0]
    if (!activeTarget) return

    setIsReflecting(true)
    setReflectError(null)
    try {
      const services = await window.reqstraApi.grpcReflect(activeTarget.host, activeTarget.secure)
      const p = useProjectStore.getState().project
      if (!p) return

      const kept = p.collections.filter(
        (c) => !(c.protocol === 'grpc' && c.protocolTargetId === activeTarget.id),
      )
      const fetched: Collection[] = services.map((svc) => ({
        id: crypto.randomUUID(),
        protocol: 'grpc' as const,
        name: svc.name,
        protocolTargetId: activeTarget.id,
        endpoints: svc.methods.map((method) => ({
          id: crypto.randomUUID(),
          name: method,
          method: `${svc.name}/${method}`,
          casesDir: `requests/grpc/${svc.name}/${method}`,
        })),
      }))
      useProjectStore.getState().setProject({ ...p, collections: [...kept, ...fetched] })
      await persistProject()
    } catch (e) {
      setReflectError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsReflecting(false)
    }
  }

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
      type: 'case',
      id: `${ep.id}::${caseName}`,
      label: `${ep.name} / ${caseName.replace(/\.ya?ml$/, '')}`,
      endpointId: ep.id,
      caseName,
    })
  }

  const handleCollectionSubmit = async (col: Collection): Promise<void> => {
    setIsSubmitting(true)
    try {
      if (modalState?.type === 'add-collection') {
        addCollection(col)
      } else {
        updateCollection(col)
      }
      if (await persistProject()) setModalState(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCollectionDelete = async (id: string): Promise<void> => {
    if (!window.confirm('コレクションを削除しますか？')) return
    deleteCollection(id)
    if (await persistProject()) return
  }

  const handleEndpointSubmit = async (ep: GrpcEndpoint): Promise<void> => {
    setIsSubmitting(true)
    try {
      if (modalState?.type === 'add-endpoint') {
        addEndpoint(modalState.collectionId, ep)
      } else if (modalState?.type === 'edit-endpoint') {
        updateEndpoint(modalState.collectionId, ep)
      }
      if (await persistProject()) setModalState(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEndpointDelete = async (collectionId: string, endpointId: string): Promise<void> => {
    if (!window.confirm('エンドポイントを削除しますか？')) return
    deleteEndpoint(collectionId, endpointId)
    await persistProject()
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-2 py-1">
        <span className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
          コレクション
        </span>
        <div className="flex items-center gap-1">
          {activeProtocol === 'grpc' && (
            <button
              type="button"
              onClick={handleReflect}
              disabled={isReflecting || ((activeEnv?.protocols?.grpc as GrpcTarget[] | undefined) ?? []).length === 0}
              title="サーバーリフレクションでサービスを取得"
              className="rounded bg-[#3c3c3c] px-1.5 py-0.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-40"
            >
              {isReflecting ? '取得中...' : '取得'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setModalState({ type: 'add-collection' })}
            title="コレクションを追加"
            className="rounded bg-[var(--color-bg-active)] px-1.5 py-0.5 text-xs text-white"
          >
            ＋
          </button>
        </div>
      </div>

      {reflectError && <p className="px-2 pt-1 text-xs text-[var(--color-error)]">{reflectError}</p>}
      {saveError && <p className="px-2 pt-1 text-xs text-[var(--color-error)]">{saveError}</p>}

      <div className="flex-1 overflow-y-auto py-1 text-xs">
        {collections.length === 0 && (
          <p className="px-3 text-[var(--color-text-secondary)]">コレクションなし</p>
        )}
        {collections.map((col) => (
          <div key={col.id}>
            <div className="group flex items-center px-2 py-0.5 hover:bg-[var(--color-bg-tertiary)]">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center text-left text-[var(--color-text-secondary)]"
                onClick={() => toggleCollection(col.id)}
              >
                <span className="mr-1 shrink-0">{expandedCollections.has(col.id) ? '▾' : '▸'}</span>
                <span className="truncate font-medium">{col.name}</span>
              </button>
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
                {col.protocol !== 'grpc' && (
                  <button
                    type="button"
                    onClick={() => setModalState({ type: 'add-endpoint', collectionId: col.id })}
                    title="エンドポイントを追加"
                    className="rounded px-1 py-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  >
                    ＋
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setModalState({ type: 'edit-collection', collection: col })}
                  title="コレクションを編集"
                  className="rounded px-1 py-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => handleCollectionDelete(col.id)}
                  title="コレクションを削除"
                  className="rounded px-1 py-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-error)]"
                >
                  ×
                </button>
              </div>
            </div>
            {expandedCollections.has(col.id) &&
              col.endpoints.map((ep) => (
                <div key={ep.id}>
                  <div className="group flex items-center py-0.5 pl-5 pr-2 hover:bg-[var(--color-bg-tertiary)]">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center text-left text-[var(--color-text-primary)]"
                      onClick={() => {
                        void toggleEndpoint(ep)
                        openTab({
                          type: 'scratch',
                          id: `scratch::${ep.id}`,
                          label: ep.name,
                          endpointId: ep.id,
                        })
                      }}
                    >
                      <span className="mr-1 shrink-0">{expandedEndpoints.has(ep.id) ? '▾' : '▸'}</span>
                      <span className="truncate">{ep.name}</span>
                    </button>
                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() =>
                          setModalState({ type: 'edit-endpoint', collectionId: col.id, endpoint: ep })
                        }
                        title="エンドポイントを編集"
                        className="rounded px-1 py-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEndpointDelete(col.id, ep.id)}
                        title="エンドポイントを削除"
                        className="rounded px-1 py-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-error)]"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  {expandedEndpoints.has(ep.id) &&
                    (casesByEndpoint[ep.id] ?? []).map((caseName) => (
                      <button
                        key={caseName}
                        type="button"
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

      {modalState?.type === 'add-collection' && (
        <CollectionModal
          mode="add"
          environment={activeEnv}
          isSubmitting={isSubmitting}
          onSubmit={handleCollectionSubmit}
          onClose={() => setModalState(null)}
        />
      )}
      {modalState?.type === 'edit-collection' && (
        <CollectionModal
          mode="edit"
          initial={modalState.collection}
          environment={activeEnv}
          isSubmitting={isSubmitting}
          onSubmit={handleCollectionSubmit}
          onClose={() => setModalState(null)}
        />
      )}
      {modalState?.type === 'add-endpoint' && (
        <EndpointModal
          mode="add"
          protocol={activeProtocol}
          isSubmitting={isSubmitting}
          onSubmit={handleEndpointSubmit}
          onClose={() => setModalState(null)}
        />
      )}
      {modalState?.type === 'edit-endpoint' && (
        <EndpointModal
          mode="edit"
          protocol={activeProtocol}
          initial={modalState.endpoint}
          isSubmitting={isSubmitting}
          onSubmit={handleEndpointSubmit}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  )
}
