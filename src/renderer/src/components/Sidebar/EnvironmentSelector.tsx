import { useProjectStore } from '../../store/projectStore'
import { useAppStore } from '../../store/appStore'

export function EnvironmentSelector(): JSX.Element {
  const environments = useProjectStore((s) => s.project?.environments ?? [])
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const setActiveEnvironmentId = useAppStore((s) => s.setActiveEnvironmentId)

  const active = environments.find((e) => e.id === activeEnvironmentId) ?? environments[0]

  return (
    <div className="border-b border-[var(--color-border)] px-2 py-1">
      <select
        value={active?.id ?? ''}
        onChange={(e) => setActiveEnvironmentId(e.target.value)}
        className="w-full rounded bg-[#3c3c3c] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none"
      >
        {environments.map((env) => (
          <option key={env.id} value={env.id}>
            🌍 {env.name}
          </option>
        ))}
        {environments.length === 0 && <option value="">環境未設定</option>}
      </select>
    </div>
  )
}
