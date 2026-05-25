import { useState, type JSX } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useAppStore } from '../../store/appStore'
import type { GrpcTarget, HttpTarget, GraphQLTarget } from '../../../../shared/types/project'
import { ProtocolTargetModal } from '../modals/ProtocolTargetModal'

type ModalState =
  | { type: 'add' }
  | { type: 'edit'; target: GrpcTarget | HttpTarget | GraphQLTarget }
  | null

export function ProtocolTargetSelector(): JSX.Element {
  const project = useProjectStore((s) => s.project)
  const addProtocolTarget = useProjectStore((s) => s.addProtocolTarget)
  const updateProtocolTarget = useProjectStore((s) => s.updateProtocolTarget)
  const deleteProtocolTarget = useProjectStore((s) => s.deleteProtocolTarget)
  const activeProtocol = useAppStore((s) => s.activeProtocol)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const activeProtocolTargetId = useAppStore((s) => s.activeProtocolTargetId)
  const setActiveProtocolTargetId = useAppStore((s) => s.setActiveProtocolTargetId)

  const [modal, setModal] = useState<ModalState>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const env =
    project?.environments.find((e) => e.id === activeEnvironmentId) ?? project?.environments[0]

  // 各プロトコルターゲット型（GrpcTarget等）は name/id を共通で持つため共通型にキャストする
  const targets =
    (env?.protocols?.[activeProtocol] as Array<{ id: string; name: string }> | undefined) ?? []
  const active = targets.find((t) => t.id === activeProtocolTargetId) ?? targets[0]

  const activeEnvId = env?.id ?? ''

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

  const handleSubmit = async (target: GrpcTarget | HttpTarget | GraphQLTarget): Promise<void> => {
    setIsSubmitting(true)
    try {
      if (modal?.type === 'add') {
        addProtocolTarget(activeEnvId, activeProtocol, target)
        setActiveProtocolTargetId(target.id)
      } else {
        updateProtocolTarget(activeEnvId, activeProtocol, target)
      }
      if (await persistProject()) setModal(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (targetId: string): Promise<void> => {
    setIsSubmitting(true)
    try {
      deleteProtocolTarget(activeEnvId, activeProtocol, targetId)
      if (activeProtocolTargetId === targetId) {
        const remaining =
          (useProjectStore.getState().project?.environments
            .find((e) => e.id === activeEnvId)
            ?.protocols?.[activeProtocol] as Array<{ id: string }> | undefined) ?? []
        setActiveProtocolTargetId(remaining[0]?.id ?? null)
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
          onChange={(e) => setActiveProtocolTargetId(e.target.value)}
          className="min-w-0 flex-1 rounded bg-[#3c3c3c] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none"
        >
          {targets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
          {targets.length === 0 && <option value="">ターゲット未設定</option>}
        </select>
        {active && (
          <button
            type="button"
            onClick={() => {
              const fullTarget =
                (env?.protocols?.[activeProtocol] as Array<GrpcTarget | HttpTarget | GraphQLTarget> | undefined)
                  ?.find((t) => t.id === active.id)
              if (fullTarget) setModal({ type: 'edit', target: fullTarget })
            }}
            title="ターゲットを編集"
            className="shrink-0 rounded bg-[#3c3c3c] px-1.5 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            ✎
          </button>
        )}
        <button
          type="button"
          onClick={() => setModal({ type: 'add' })}
          title="ターゲットを追加"
          className="shrink-0 rounded bg-[var(--color-bg-active)] px-1.5 py-1 text-xs text-white"
        >
          ＋
        </button>
      </div>
      {saveError && <p className="mt-1 text-xs text-[var(--color-error)]">{saveError}</p>}
      {modal && (
        <ProtocolTargetModal
          mode={modal.type}
          protocol={activeProtocol}
          initial={modal.type === 'edit' ? modal.target : undefined}
          onSubmit={handleSubmit}
          onDelete={modal.type === 'edit' ? () => handleDelete(modal.target.id) : undefined}
          isSubmitting={isSubmitting}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
