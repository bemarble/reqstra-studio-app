import React, { useState, type JSX } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useAppStore } from '../../store/appStore'
import type { Environment } from '../../../../shared/types/project'
import { EnvironmentModal } from '../modals/EnvironmentModal'

type ModalState = { type: 'add' } | { type: 'edit'; env: Environment } | null

export function EnvironmentSelector(): JSX.Element {
  const environments = useProjectStore((s) => s.project?.environments ?? [])
  const addEnvironment = useProjectStore((s) => s.addEnvironment)
  const updateEnvironment = useProjectStore((s) => s.updateEnvironment)
  const deleteEnvironment = useProjectStore((s) => s.deleteEnvironment)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const setActiveEnvironmentId = useAppStore((s) => s.setActiveEnvironmentId)

  const [modal, setModal] = useState<ModalState>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const active = environments.find((e) => e.id === activeEnvironmentId) ?? environments[0]

  const getDeleteWarning = (envId: string): string | undefined => {
    const p = useProjectStore.getState().project
    if (!p) return undefined
    const env = p.environments.find((e) => e.id === envId)
    if (!env) return undefined
    const targetIds = new Set<string>(
      Object.values(env.protocols).flatMap(
        (targets) => (targets as Array<{ id: string }> | undefined)?.map((t) => t.id) ?? [],
      ),
    )
    const affected = p.collections.filter((c) => targetIds.has(c.protocolTargetId))
    if (affected.length === 0) return undefined
    return `以下のコレクションがこの環境のターゲットを参照しています: ${affected.map((c) => c.name).join('、')}`
  }

  const persistProject = async (): Promise<boolean> => {
    const project = useProjectStore.getState().project
    if (!project) return false
    try {
      await window.reqstraApi.saveProject(project)
      setSaveError(null)
      return true
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
      return false
    }
  }

  const handleSubmit = async (env: Environment): Promise<void> => {
    setIsSubmitting(true)
    try {
      if (modal?.type === 'add') {
        addEnvironment(env)
        setActiveEnvironmentId(env.id)
      } else {
        updateEnvironment(env)
      }
      if (await persistProject()) setModal(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string): Promise<void> => {
    setIsSubmitting(true)
    try {
      deleteEnvironment(id)
      if (activeEnvironmentId === id) {
        const remaining = useProjectStore.getState().project?.environments ?? []
        setActiveEnvironmentId(remaining[0]?.id ?? null)
      }
      if (await persistProject()) setModal(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="border-b border-[var(--color-border)] px-2 py-1">
      <div className="flex items-center gap-1">
        <select
          value={active?.id ?? ''}
          onChange={(e) => setActiveEnvironmentId(e.target.value)}
          className="min-w-0 flex-1 rounded bg-[#3c3c3c] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none"
        >
          {environments.map((env) => (
            <option key={env.id} value={env.id}>
              🌍 {env.name}
            </option>
          ))}
          {environments.length === 0 && <option value="">環境未設定</option>}
        </select>
        {active && (
          <button
            type="button"
            onClick={() => setModal({ type: 'edit', env: active })}
            title="環境を編集"
            className="shrink-0 rounded bg-[#3c3c3c] px-1.5 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            ✎
          </button>
        )}
        <button
          type="button"
          onClick={() => setModal({ type: 'add' })}
          title="環境を追加"
          className="shrink-0 rounded bg-[var(--color-bg-active)] px-1.5 py-1 text-xs text-white"
        >
          ＋
        </button>
      </div>
      {saveError && <p className="mt-1 text-xs text-[var(--color-error)]">{saveError}</p>}
      {modal && (
        <EnvironmentModal
          mode={modal.type}
          initial={modal.type === 'edit' ? modal.env : undefined}
          onSubmit={handleSubmit}
          onDelete={modal.type === 'edit' ? () => handleDelete(modal.env.id) : undefined}
          deleteWarning={modal.type === 'edit' ? getDeleteWarning(modal.env.id) : undefined}
          isSubmitting={isSubmitting}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
