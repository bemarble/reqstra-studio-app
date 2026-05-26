import React, { useState, useEffect, Fragment, type JSX } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useAppStore } from '../../store/appStore'
import type { Collection, GrpcEndpoint, GrpcTarget, GraphQLEndpoint } from '../../../../shared/types/project'
import { CollectionModal } from '../modals/CollectionModal'
import { EndpointModal } from '../modals/EndpointModal'
import { GraphQLEndpointModal } from '../modals/GraphQLEndpointModal'
import * as path from 'path'

type ModalState =
  | { type: 'add-collection' }
  | { type: 'edit-collection'; collection: Collection }
  | { type: 'add-endpoint'; collectionId: string }
  | { type: 'edit-endpoint'; collectionId: string; endpoint: GrpcEndpoint | GraphQLEndpoint }
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
  const closeTab = useAppStore((s) => s.closeTab)
  const activeCaseDirs = useProjectStore((s) => s.activeCaseDirs)
  const casesByEndpoint = useProjectStore((s) => s.casesByEndpoint)
  const setCasesForEndpoint = useProjectStore((s) => s.setCasesForEndpoint)

  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set())
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<string>>(new Set())
  const [modalState, setModalState] = useState<ModalState>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [isReflecting, setIsReflecting] = useState<boolean>(false)
  const [reflectError, setReflectError] = useState<string | null>(null)
  const [isReflected, setIsReflected] = useState<boolean>(false)
  const [pendingDuplicate, setPendingDuplicate] = useState<{
    endpointId: string
    sourceName: string
    inputValue: string
  } | null>(null)

  useEffect(() => {
    setIsReflected(false)
  }, [project?.projectDir])

  const collections = (project?.collections ?? []).filter(
    (c) => c.protocol === activeProtocol && c.protocolTargetId === activeProtocolTargetId,
  )

  const isEndpointVisible = (ep: GrpcEndpoint | GraphQLEndpoint): boolean =>
    activeProtocol !== 'grpc' || isReflected || activeCaseDirs.has(ep.casesDir)

  const visibleCollections = collections.filter((col) =>
    col.protocol !== 'grpc' || col.endpoints.some((ep) => isEndpointVisible(ep)),
  )

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

      const existingNames = new Set(
        p.collections
          .filter((c) => c.protocol === 'grpc' && c.protocolTargetId === activeTarget.id)
          .map((c) => c.name),
      )
      const toAdd = fetched.filter((c) => !existingNames.has(c.name))
      useProjectStore.getState().setProject({ ...p, collections: [...p.collections, ...toAdd] })
      await persistProject()
      setIsReflected(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[grpc:reflect]', e)
      setReflectError(msg)
    } finally {
      setIsReflecting(false)
    }
  }

  const toggleCollection = async (id: string): Promise<void> => {
    if (!expandedCollections.has(id) && project) {
      const col = collections.find((c) => c.id === id)
      if (col?.protocol === 'graphql') {
        const ep = col.endpoints[0]
        if (ep) {
          const casesAbsDir = path.join(project.projectDir, ep.casesDir)
          const cases = await window.reqstraApi.listCases(casesAbsDir)
          setCasesForEndpoint(ep.id, cases)
        }
      }
    }
    setExpandedCollections((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleEndpoint = async (ep: GrpcEndpoint | GraphQLEndpoint): Promise<void> => {
    if (!project) return
    const casesAbsDir = path.join(project.projectDir, ep.casesDir)
    if (!expandedEndpoints.has(ep.id)) {
      const cases = await window.reqstraApi.listCases(casesAbsDir)
      setCasesForEndpoint(ep.id, cases)
    }
    setExpandedEndpoints((prev) => {
      const next = new Set(prev)
      next.has(ep.id) ? next.delete(ep.id) : next.add(ep.id)
      return next
    })
  }

  const handleCaseClick = (_col: Collection, ep: GrpcEndpoint | GraphQLEndpoint, caseName: string): void => {
    openTab({
      type: 'case',
      id: `${ep.id}::${caseName}`,
      label: `${ep.name} / ${caseName.replace(/\.ya?ml$/, '')}`,
      endpointId: ep.id,
      caseName,
    })
  }

  const handleCaseDuplicate = (ep: GrpcEndpoint | GraphQLEndpoint, caseName: string): void => {
    const base = caseName.replace(/\.ya?ml$/, '')
    setPendingDuplicate({ endpointId: ep.id, sourceName: caseName, inputValue: `${base}_copy` })
  }

  const handleCaseDuplicateConfirm = async (ep: GrpcEndpoint | GraphQLEndpoint): Promise<void> => {
    if (!project || !pendingDuplicate) return
    const rawName = pendingDuplicate.inputValue.trim()
    const sourceName = pendingDuplicate.sourceName
    if (!rawName) {
      setPendingDuplicate(null)
      return
    }
    const ext = sourceName.match(/\.ya?ml$/)?.[0] ?? '.yaml'
    const newName = rawName.endsWith('.yaml') || rawName.endsWith('.yml') ? rawName : `${rawName}${ext}`
    const casesAbsDir = path.join(project.projectDir, ep.casesDir)
    setPendingDuplicate(null)
    try {
      const freshCases = await window.reqstraApi.listCases(casesAbsDir)
      if (freshCases.includes(newName)) {
        alert(`"${newName.replace(/\.ya?ml$/, '')}" はすでに存在します`)
        return
      }
      const content = await window.reqstraApi.readCase(path.join(casesAbsDir, sourceName))
      await window.reqstraApi.writeCase(path.join(casesAbsDir, newName), content)
      setCasesForEndpoint(ep.id, [...freshCases, newName])
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    }
  }

  const handleCaseDelete = async (ep: GrpcEndpoint | GraphQLEndpoint, caseName: string): Promise<void> => {
    if (!project) return
    if (!window.confirm(`"${caseName.replace(/\.ya?ml$/, '')}" を削除しますか？`)) return
    const absolutePath = path.join(project.projectDir, ep.casesDir, caseName)
    try {
      await window.reqstraApi.deleteCase(absolutePath)
      setCasesForEndpoint(ep.id, (casesByEndpoint[ep.id] ?? []).filter((c) => c !== caseName))
      closeTab(`${ep.id}::${caseName}`)
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    }
  }

  const handleCollectionSubmit = async (col: Collection): Promise<void> => {
    setIsSubmitting(true)
    try {
      if (modalState?.type === 'add-collection') {
        if (col.protocol === 'graphql') {
          const autoEndpoint: GraphQLEndpoint = {
            id: crypto.randomUUID(),
            name: col.name,
            casesDir: `requests/graphql/${col.name}`,
          }
          addCollection({ ...col, endpoints: [autoEndpoint] })
        } else {
          addCollection(col)
        }
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

  const handleEndpointSubmit = async (ep: GrpcEndpoint | GraphQLEndpoint): Promise<void> => {
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-2 py-1">
        <span className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
          {activeProtocol === 'graphql' ? 'クエリ' : 'コレクション'}
        </span>
        <div className="flex items-center gap-1">
          {activeProtocol === 'grpc' && (
            <button
              type="button"
              onClick={handleReflect}
              disabled={isReflecting || ((activeEnv?.protocols?.grpc as GrpcTarget[] | undefined) ?? []).length === 0}
              title="サーバーリフレクションでサービスを取得"
              className="rounded bg-[#3c3c3c] px-2 py-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-40"
            >
              {isReflecting ? '取得中...' : '取得'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setModalState({ type: 'add-collection' })}
            title={activeProtocol === 'graphql' ? 'クエリを追加' : 'コレクションを追加'}
            className="rounded bg-[var(--color-bg-active)] px-2 py-1 text-sm text-white"
          >
            ＋
          </button>
        </div>
      </div>

      {reflectError && <p className="px-2 pt-1 text-xs text-[var(--color-error)]">{reflectError}</p>}
      {saveError && <p className="px-2 pt-1 text-xs text-[var(--color-error)]">{saveError}</p>}

      <div className="min-h-0 flex-1 overflow-y-auto py-1 text-sm">
        {visibleCollections.length === 0 && (
          <p className="px-3 text-[var(--color-text-secondary)]">コレクションなし</p>
        )}
        {visibleCollections.map((col) => (
          <div key={col.id}>
            <div className="group flex items-center px-2 py-1 hover:bg-[var(--color-bg-tertiary)]">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center text-left text-[var(--color-text-secondary)]"
                onClick={() => {
                  void toggleCollection(col.id)
                  if (col.protocol === 'graphql') {
                    const ep = col.endpoints[0]
                    if (ep) {
                      openTab({ type: 'scratch', id: `scratch::${ep.id}`, label: col.name, endpointId: ep.id })
                    }
                  }
                }}
              >
                <span className="mr-1.5 shrink-0 text-base leading-none">{expandedCollections.has(col.id) ? '▾' : '▸'}</span>
                <span className="truncate font-medium">{col.name}</span>
              </button>
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
                {col.protocol === 'graphql' && (
                  <button
                    type="button"
                    onClick={() => {
                      const ep = col.endpoints[0]
                      if (!ep) return
                      openTab({ type: 'scratch', id: `scratch::${ep.id}`, label: col.name, endpointId: ep.id })
                      if (!expandedCollections.has(col.id) && project) {
                        const casesAbsDir = path.join(project.projectDir, ep.casesDir)
                        window.reqstraApi.listCases(casesAbsDir)
                          .then((cases) => {
                            setCasesForEndpoint(ep.id, cases)
                            setExpandedCollections((prev) => new Set([...prev, col.id]))
                          })
                          .catch(console.error)
                      }
                    }}
                    title="ケースを作成"
                    className="rounded px-1.5 py-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  >
                    ＋
                  </button>
                )}
                {col.protocol !== 'grpc' && col.protocol !== 'graphql' && (
                  <button
                    type="button"
                    onClick={() => setModalState({ type: 'add-endpoint', collectionId: col.id })}
                    title="エンドポイントを追加"
                    className="rounded px-1.5 py-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  >
                    ＋
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setModalState({ type: 'edit-collection', collection: col })}
                  title={activeProtocol === 'graphql' ? 'クエリを編集' : 'コレクションを編集'}
                  className="rounded px-1.5 py-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  ✎
                </button>
                {col.protocol !== 'grpc' && (
                  <button
                    type="button"
                    onClick={() => handleCollectionDelete(col.id)}
                    title={activeProtocol === 'graphql' ? 'クエリを削除' : 'コレクションを削除'}
                    className="rounded px-1.5 py-1 text-[var(--color-text-secondary)] hover:text-[var(--color-error)]"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
            {/* GraphQL: ケースをコレクション直下に表示（エンドポイント行は非表示） */}
            {expandedCollections.has(col.id) && col.protocol === 'graphql' && (() => {
              const ep = col.endpoints[0]
              if (!ep) return null
              return (casesByEndpoint[ep.id] ?? []).map((caseName) => (
                <Fragment key={caseName}>
                  <div className="group flex items-center py-1 pl-5 pr-2 hover:bg-[var(--color-bg-tertiary)]">
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left text-[var(--color-text-secondary)] hover:text-white"
                      onClick={() => handleCaseClick(col, ep, caseName)}
                    >
                      {caseName.replace(/\.ya?ml$/, '')}
                    </button>
                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => handleCaseDuplicate(ep, caseName)}
                        title="ケースを複製"
                        className="rounded px-1.5 py-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      >
                        ⎘
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCaseDelete(ep, caseName)}
                        title="ケースを削除"
                        className="rounded px-1.5 py-1 text-[var(--color-text-secondary)] hover:text-[var(--color-error)]"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  {pendingDuplicate?.endpointId === ep.id &&
                    pendingDuplicate.sourceName === caseName && (
                      <div className="flex items-center py-1 pl-5 pr-2">
                        <input
                          type="text"
                          // eslint-disable-next-line jsx-a11y/no-autofocus
                          autoFocus
                          value={pendingDuplicate.inputValue}
                          onChange={(e) =>
                            setPendingDuplicate({ ...pendingDuplicate, inputValue: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleCaseDuplicateConfirm(ep)
                            if (e.key === 'Escape') setPendingDuplicate(null)
                          }}
                          onBlur={() => setPendingDuplicate(null)}
                          className="w-full rounded border border-[var(--color-text-accent)] bg-[#3c3c3c] px-1.5 py-0.5 text-sm text-[var(--color-text-primary)] outline-none"
                        />
                      </div>
                    )}
                </Fragment>
              ))
            })()}
            {/* gRPC / HTTP: エンドポイント行を表示 */}
            {expandedCollections.has(col.id) && col.protocol !== 'graphql' &&
              col.endpoints
                .filter((ep) => isEndpointVisible(ep))
                .map((ep) => (
                <div key={ep.id}>
                  <div className="group flex items-center py-1 pl-5 pr-2 hover:bg-[var(--color-bg-tertiary)]">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center text-left text-[var(--color-text-primary)]"
                      onClick={() => {
                        if (!expandedEndpoints.has(ep.id)) {
                          void toggleEndpoint(ep)
                        }
                        openTab({
                          type: 'scratch',
                          id: `scratch::${ep.id}`,
                          label: ep.name,
                          endpointId: ep.id,
                        })
                      }}
                    >
                      <span className="mr-1.5 shrink-0 text-base leading-none">{expandedEndpoints.has(ep.id) ? '▾' : '▸'}</span>
                      <span className="truncate">{ep.name}</span>
                    </button>
                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() =>
                          setModalState({ type: 'edit-endpoint', collectionId: col.id, endpoint: ep })
                        }
                        title="エンドポイントを編集"
                        className="rounded px-1.5 py-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      >
                        ✎
                      </button>
                      {col.protocol !== 'grpc' && (
                        <button
                          type="button"
                          onClick={() => handleEndpointDelete(col.id, ep.id)}
                          title="エンドポイントを削除"
                          className="rounded px-1.5 py-1 text-[var(--color-text-secondary)] hover:text-[var(--color-error)]"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                  {expandedEndpoints.has(ep.id) &&
                    (casesByEndpoint[ep.id] ?? []).map((caseName) => (
                      <Fragment key={caseName}>
                        <div
                          className="group flex items-center py-1 pl-10 pr-2 hover:bg-[var(--color-bg-tertiary)]"
                        >
                          <button
                            type="button"
                            className="min-w-0 flex-1 truncate text-left text-[var(--color-text-secondary)] hover:text-white"
                            onClick={() => handleCaseClick(col, ep, caseName)}
                          >
                            {caseName.replace(/\.ya?ml$/, '')}
                          </button>
                          <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => handleCaseDuplicate(ep, caseName)}
                              title="ケースを複製"
                              className="rounded px-1.5 py-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                            >
                              ⎘
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleCaseDelete(ep, caseName)}
                              title="ケースを削除"
                              className="rounded px-1.5 py-1 text-[var(--color-text-secondary)] hover:text-[var(--color-error)]"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                        {pendingDuplicate?.endpointId === ep.id &&
                          pendingDuplicate.sourceName === caseName && (
                            <div className="flex items-center py-1 pl-10 pr-2">
                              <input
                                type="text"
                                // eslint-disable-next-line jsx-a11y/no-autofocus
                                autoFocus
                                value={pendingDuplicate.inputValue}
                                onChange={(e) =>
                                  setPendingDuplicate({ ...pendingDuplicate, inputValue: e.target.value })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') void handleCaseDuplicateConfirm(ep)
                                  if (e.key === 'Escape') setPendingDuplicate(null)
                                }}
                                onBlur={() => setPendingDuplicate(null)}
                                className="w-full rounded border border-[var(--color-text-accent)] bg-[#3c3c3c] px-1.5 py-0.5 text-sm text-[var(--color-text-primary)] outline-none"
                              />
                            </div>
                          )}
                      </Fragment>
                    ))}
                </div>
              ))}
          </div>
        ))}
      </div>

      {modalState?.type === 'add-collection' && (
        <CollectionModal
          mode="add"
          activeProtocol={activeProtocol}
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
          activeProtocol={activeProtocol}
          environment={activeEnv}
          isSubmitting={isSubmitting}
          onSubmit={handleCollectionSubmit}
          onClose={() => setModalState(null)}
        />
      )}
      {modalState?.type === 'add-endpoint' && activeProtocol === 'graphql' && (
        <GraphQLEndpointModal
          mode="add"
          isSubmitting={isSubmitting}
          onSubmit={handleEndpointSubmit}
          onClose={() => setModalState(null)}
        />
      )}
      {modalState?.type === 'add-endpoint' && activeProtocol !== 'graphql' && (
        <EndpointModal
          mode="add"
          protocol={activeProtocol}
          isSubmitting={isSubmitting}
          onSubmit={handleEndpointSubmit}
          onClose={() => setModalState(null)}
        />
      )}
      {modalState?.type === 'edit-endpoint' && activeProtocol === 'graphql' && (
        <GraphQLEndpointModal
          mode="edit"
          initial={modalState.endpoint as GraphQLEndpoint}
          isSubmitting={isSubmitting}
          onSubmit={handleEndpointSubmit}
          onClose={() => setModalState(null)}
        />
      )}
      {modalState?.type === 'edit-endpoint' && activeProtocol !== 'graphql' && (
        <EndpointModal
          mode="edit"
          protocol={activeProtocol}
          initial={modalState.endpoint as GrpcEndpoint}
          isSubmitting={isSubmitting}
          onSubmit={handleEndpointSubmit}
          onClose={() => setModalState(null)}
        />
      )}
    </div>
  )
}
