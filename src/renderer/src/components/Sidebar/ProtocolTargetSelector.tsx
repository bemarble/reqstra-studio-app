import { useProjectStore } from '../../store/projectStore'
import { useAppStore } from '../../store/appStore'

export function ProtocolTargetSelector(): JSX.Element {
  const project = useProjectStore((s) => s.project)
  const activeProtocol = useAppStore((s) => s.activeProtocol)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const activeProtocolTargetId = useAppStore((s) => s.activeProtocolTargetId)
  const setActiveProtocolTargetId = useAppStore((s) => s.setActiveProtocolTargetId)

  const env =
    project?.environments.find((e) => e.id === activeEnvironmentId) ??
    project?.environments[0]

  // 各プロトコルターゲット型（GrpcTarget等）は name/id を共通で持つため共通型にキャストする
  const targets = (env?.protocols?.[activeProtocol] as Array<{ id: string; name: string }> | undefined) ?? []
  const active = targets.find((t) => t.id === activeProtocolTargetId) ?? targets[0]

  return (
    <div className="border-b border-[var(--color-border)] px-2 py-1">
      <select
        value={active?.id ?? ''}
        onChange={(e) => setActiveProtocolTargetId(e.target.value)}
        className="w-full rounded bg-[#3c3c3c] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none"
      >
        {targets.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
        {targets.length === 0 && <option value="">ターゲット未設定</option>}
      </select>
    </div>
  )
}
