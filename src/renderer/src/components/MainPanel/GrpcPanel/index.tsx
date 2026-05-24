import { useState, useEffect, useCallback } from 'react'
import { RequestEditor } from './RequestEditor'
import { ResponseViewer } from './ResponseViewer'
import { useAppStore, type Tab } from '../../../store/appStore'
import { useProjectStore } from '../../../store/projectStore'
import type { GrpcResponse, GrpcRequestParams, LogEntry } from '../../../../../shared/types/ipc'
import type { GrpcEndpoint } from '../../../../../shared/types/project'
import * as path from 'path'

interface Props {
  tab: Tab
}

export function GrpcPanel({ tab }: Props): JSX.Element {
  const project = useProjectStore((s) => s.project)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const activeProtocolTargetId = useAppStore((s) => s.activeProtocolTargetId)

  const [body, setBody] = useState<string>('')
  const [metadata, setMetadata] = useState<Record<string, string>>({})
  const [response, setResponse] = useState<GrpcResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const endpoint = project?.collections
    .flatMap((c) => c.endpoints)
    .find((ep) => ep.id === tab.endpointId) as GrpcEndpoint | undefined

  const collection = project?.collections.find((c) =>
    c.endpoints.some((ep) => ep.id === tab.endpointId)
  )

  useEffect(() => {
    if (!project || !endpoint) return
    const filePath = path.join(project.projectDir, endpoint.casesDir, tab.caseName)
    window.reqstraApi.readCase(filePath).then(setBody).catch(() => setBody(''))
  }, [tab.id, project, endpoint])

  const handleBodyChange = useCallback(
    (newBody: string): void => {
      setBody(newBody)
      if (!project || !endpoint) return
      const filePath = path.join(project.projectDir, endpoint.casesDir, tab.caseName)
      window.reqstraApi.writeCase(filePath, newBody).catch(console.error)
    },
    [project, endpoint, tab.caseName]
  )

  const handleSend = async (): Promise<void> => {
    if (!project || !endpoint || !collection) return

    const env =
      project.environments.find((e) => e.id === activeEnvironmentId) ??
      project.environments[0]
    const grpcTargets = env?.protocols?.grpc ?? []
    const target =
      grpcTargets.find((t) => t.id === activeProtocolTargetId) ?? grpcTargets[0]

    if (!target) {
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
      host: target.host,
      secure: target.secure,
      method: endpoint.method,
      body,
      metadata,
    }

    setIsLoading(true)
    const result = await window.reqstraApi.grpcRequest(params)
    setIsLoading(false)
    setResponse(result)

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      protocol: 'grpc',
      collectionName: collection.name,
      endpointName: endpoint.name,
      caseName: tab.caseName,
      status: result.status,
      durationMs: result.durationMs,
      request: params.body,
      response: result.body,
    }
    window.reqstraApi.writeLog(project.projectDir, logEntry).catch(console.error)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
        <span className="rounded bg-[#0e639c] px-2 py-0.5 text-xs font-medium text-white">gRPC</span>
        <span className="flex-1 truncate text-xs text-[var(--color-text-secondary)]">
          {endpoint?.method ?? tab.label}
        </span>
        <button
          onClick={handleSend}
          disabled={isLoading}
          className="rounded bg-[#0e639c] px-4 py-1 text-xs text-white hover:bg-[#1177bb] disabled:opacity-50"
        >
          ▶ Send
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden border-r border-[var(--color-border)]">
          <RequestEditor
            tab={tab}
            body={body}
            metadata={metadata}
            onBodyChange={handleBodyChange}
            onMetadataChange={setMetadata}
          />
        </div>
        <div className="w-80 overflow-hidden">
          <ResponseViewer response={response} isLoading={isLoading} />
        </div>
      </div>
    </div>
  )
}
