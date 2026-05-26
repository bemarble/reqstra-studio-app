import { useState, useEffect, useCallback, type JSX } from 'react'
import { RequestEditor } from './RequestEditor'
import { ResponseViewer } from './ResponseViewer'
import { ResizablePanes } from '../../shared/ResizablePanes'
import { useAppStore, type Tab } from '../../../store/appStore'
import { useProjectStore } from '../../../store/projectStore'
import type { GrpcResponse, GrpcRequestParams, LogEntry } from '../../../../../shared/types/ipc'
import type { GrpcTarget, GrpcEndpoint } from '../../../../../shared/types/project'
import * as path from 'path'

interface Props {
  tab: Tab
}

export function GrpcPanel({ tab }: Props): JSX.Element {
  const project = useProjectStore((s) => s.project)
  const setCasesForEndpoint = useProjectStore((s) => s.setCasesForEndpoint)
  const addActiveCasesDir = useProjectStore((s) => s.addActiveCasesDir)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const activeProtocolTargetId = useAppStore((s) => s.activeProtocolTargetId)
  const replaceTab = useAppStore((s) => s.replaceTab)

  const [body, setBody] = useState<string>('')
  const [metadata, setMetadata] = useState<Record<string, string>>({})
  const [response, setResponse] = useState<GrpcResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isTemplateLoading, setIsTemplateLoading] = useState<boolean>(false)
  const [saveNameInput, setSaveNameInput] = useState<string>('')
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const endpoint = project?.collections
    .flatMap((c) => c.endpoints as GrpcEndpoint[])
    .find((ep) => ep.id === tab.endpointId)

  const collection = project?.collections.find((c) =>
    (c.endpoints as GrpcEndpoint[]).some((ep) => ep.id === tab.endpointId),
  )

  const activeEnv =
    project?.environments.find((e) => e.id === activeEnvironmentId) ?? project?.environments[0]
  const grpcTargets = (activeEnv?.protocols?.grpc as GrpcTarget[] | undefined) ?? []
  const activeTarget =
    grpcTargets.find((t) => t.id === activeProtocolTargetId) ?? grpcTargets[0]

  const endpointLabel = endpoint
    ? `${activeTarget ? activeTarget.host : '(ターゲット未設定)'} / ${endpoint.method}`
    : tab.label

  useEffect(() => {
    if (!project || !endpoint) return

    if (tab.type === 'case') {
      const filePath = path.join(project.projectDir, endpoint.casesDir, tab.caseName)
      window.reqstraApi.readCase(filePath).then(setBody).catch(() => setBody(''))
      return
    }

    // scratch: fetch JSON template from proto schema
    if (!activeTarget) {
      setBody('')
      return
    }
    setIsTemplateLoading(true)
    window.reqstraApi
      .grpcDescribeMethod(activeTarget.host, activeTarget.secure, endpoint.method)
      .then((template) => setBody((prev) => prev || template))
      .catch(() => setBody(''))
      .finally(() => setIsTemplateLoading(false))
  }, [tab.id, project, endpoint, activeTarget])

  const handleBodyChange = useCallback(
    (newBody: string): void => {
      setBody(newBody)
      if (tab.type !== 'case' || !project || !endpoint) return
      const filePath = path.join(project.projectDir, endpoint.casesDir, tab.caseName)
      window.reqstraApi.writeCase(filePath, newBody).catch(console.error)
    },
    [project, endpoint, tab],
  )

  const handleSave = async (): Promise<void> => {
    const rawName = saveNameInput.trim()
    if (!rawName || !project || !endpoint) return
    setSaveError(null)
    const caseName = rawName.endsWith('.yaml') ? rawName : `${rawName}.yaml`
    const filePath = path.join(project.projectDir, endpoint.casesDir, caseName)

    setIsSaving(true)
    try {
      await window.reqstraApi.writeCase(filePath, body)
      replaceTab(tab.id, {
        type: 'case',
        id: `${endpoint.id}::${caseName}`,
        label: `${endpoint.name} / ${rawName.replace(/\.ya?ml$/, '')}`,
        endpointId: endpoint.id,
        caseName,
      })
      const casesAbsDir = path.join(project.projectDir, endpoint.casesDir)
      const updatedCases = await window.reqstraApi.listCases(casesAbsDir)
      setCasesForEndpoint(endpoint.id, updatedCases)
      addActiveCasesDir(endpoint.casesDir)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsSaving(false)
    }
  }

  const handleSend = async (): Promise<void> => {
    if (!project || !endpoint || !collection) return

    if (!activeTarget) {
      setResponse({
        status: 'ERROR',
        body: null,
        trailers: {},
        durationMs: 0,
        error: 'gRPCターゲットが設定されていません',
      })
      return
    }

    const params: GrpcRequestParams = {
      host: activeTarget.host,
      secure: activeTarget.secure,
      method: endpoint.method,
      body,
      metadata,
    }

    setIsLoading(true)
    let result: GrpcResponse
    try {
      result = await window.reqstraApi.grpcRequest(params)
    } finally {
      setIsLoading(false)
    }
    setResponse(result)

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      protocol: 'grpc',
      collectionName: collection.name,
      endpointName: endpoint.name,
      caseName: tab.type === 'case' ? tab.caseName : '(scratch)',
      status: result.status,
      durationMs: result.durationMs,
      request: params.body,
      response: result.body,
    }
    window.reqstraApi.writeLog(project.projectDir, logEntry).catch(console.error)
  }

  const language = tab.type === 'scratch' ? 'json' : 'yaml'

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
        <span className="rounded bg-[#0e639c] px-2 py-0.5 text-xs font-medium text-white">
          gRPC
        </span>
        <span className="flex-1 truncate text-xs text-[var(--color-text-secondary)]">
          {endpointLabel}
        </span>

        {tab.type === 'scratch' && (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={saveNameInput}
              onChange={(e) => setSaveNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSave()
                if (e.key === 'Escape') setSaveNameInput('')
              }}
              placeholder="ケース名"
              className="w-32 rounded border border-[var(--color-border)] bg-[#3c3c3c] px-2 py-0.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-text-accent)]"
            />
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!saveNameInput.trim() || isSaving}
              className="rounded bg-[var(--color-bg-active)] px-2 py-0.5 text-xs text-white disabled:opacity-50"
            >
              {isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        )}
        {tab.type === 'scratch' && saveError && (
          <span className="text-xs text-[var(--color-error)]">{saveError}</span>
        )}

        <button
          onClick={() => void handleSend()}
          disabled={isLoading || isTemplateLoading}
          className="rounded bg-[#0e639c] px-4 py-1 text-xs text-white hover:bg-[#1177bb] disabled:opacity-50"
        >
          {isTemplateLoading ? '読込中...' : '▶ Send'}
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <ResizablePanes
          defaultLeftWidth={480}
          minLeft={200}
          minRight={200}
          storageKey="pane-response-width"
        >
          <RequestEditor
            tab={tab}
            body={body}
            metadata={metadata}
            language={language}
            onBodyChange={handleBodyChange}
            onMetadataChange={setMetadata}
          />
          <ResponseViewer response={response} isLoading={isLoading} />
        </ResizablePanes>
      </div>
    </div>
  )
}
