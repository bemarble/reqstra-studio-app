import { useState, useEffect, useCallback, useRef, type JSX } from 'react'
import * as yaml from 'yaml'
import { parse } from 'graphql'
import { QueryEditor } from './QueryEditor'
import { ResponseViewer } from './ResponseViewer'
import { ResizablePanes } from '../../shared/ResizablePanes'
import { useAppStore, type Tab } from '../../../store/appStore'
import { useProjectStore } from '../../../store/projectStore'
import type {
  GraphQLResponse,
  GraphQLRequestParams,
  LogEntry,
} from '../../../../../shared/types/ipc'
import type { GraphQLTarget, GraphQLEndpoint, GraphQLAuth } from '../../../../../shared/types/project'
import * as path from 'path'

interface Props {
  tab: Tab
}

const DEFAULT_AUTH: GraphQLAuth = { type: 'none' }

function serializeCaseFile(variablesJson: string): string {
  if (!variablesJson.trim()) return yaml.stringify({})
  try {
    const variables = JSON.parse(variablesJson) as unknown
    return yaml.stringify({ variables })
  } catch {
    return yaml.stringify({})
  }
}

function getQueryError(query: string): string | null {
  if (!query.trim()) return null
  try {
    parse(query)
    return null
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

export function GraphQLPanel({ tab }: Props): JSX.Element {
  const project = useProjectStore((s) => s.project)
  const setCasesForEndpoint = useProjectStore((s) => s.setCasesForEndpoint)
  const addActiveCasesDir = useProjectStore((s) => s.addActiveCasesDir)
  const updateEndpoint = useProjectStore((s) => s.updateEndpoint)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const activeProtocolTargetId = useAppStore((s) => s.activeProtocolTargetId)
  const replaceTab = useAppStore((s) => s.replaceTab)

  const [query, setQuery] = useState<string>('')
  const [variablesJson, setVariablesJson] = useState<string>('')
  const [headers, setHeaders] = useState<Record<string, string>>({})
  const [auth, setAuth] = useState<GraphQLAuth>(DEFAULT_AUTH)
  const [response, setResponse] = useState<GraphQLResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [saveNameInput, setSaveNameInput] = useState<string>('')
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const endpointTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const queryError = getQueryError(query)

  const endpoint = project?.collections
    .flatMap((c) => c.endpoints as GraphQLEndpoint[])
    .find((ep) => ep.id === tab.endpointId)

  const collection = project?.collections.find((c) =>
    (c.endpoints as GraphQLEndpoint[]).some((ep) => ep.id === tab.endpointId),
  )

  const activeEnv =
    project?.environments.find((e) => e.id === activeEnvironmentId) ?? project?.environments[0]
  const graphqlTargets = (activeEnv?.protocols?.graphql as GraphQLTarget[] | undefined) ?? []
  const activeTarget =
    graphqlTargets.find((t) => t.id === activeProtocolTargetId) ?? graphqlTargets[0]

  const endpointLabel = activeTarget?.url
    ? `${activeTarget.url}${endpoint ? ` / ${endpoint.name}` : ''}`
    : '(ターゲット未設定)'

  // エンドポイントが切り替わったときに query/headers/auth を読み込む
  // これらの値を自分で保存しても再ロードしないよう endpoint.id のみを依存にする
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setQuery(endpoint?.query ?? '')
    setHeaders(endpoint?.headers ?? {})
    setAuth(endpoint?.auth ?? DEFAULT_AUTH)
  }, [endpoint?.id])

  // タブ（ケース）が切り替わったときに variables を読み込む
  useEffect(() => {
    if (!project || !endpoint || tab.type !== 'case') {
      setVariablesJson('')
      return
    }
    const filePath = path.join(project.projectDir, endpoint.casesDir, tab.caseName)
    window.reqstraApi
      .readCase(filePath)
      .then((raw) => {
        try {
          const parsed = yaml.parse(raw) as Record<string, unknown>
          setVariablesJson(
            parsed.variables !== undefined
              ? JSON.stringify(parsed.variables, null, 2)
              : '',
          )
        } catch {
          setVariablesJson('')
        }
      })
      .catch(() => {
        setVariablesJson('')
      })
  }, [tab.id, project?.projectDir, endpoint?.id])

  const saveEndpointData = useCallback(
    (q: string, hdrs: Record<string, string>, a: GraphQLAuth): void => {
      if (!endpoint || !collection) return
      const updatedEndpoint: GraphQLEndpoint = { ...endpoint, query: q, headers: hdrs, auth: a }
      updateEndpoint(collection.id, updatedEndpoint)
      const p = useProjectStore.getState().project
      if (p) window.reqstraApi.saveProject(p).catch(console.error)
    },
    [endpoint, collection, updateEndpoint],
  )

  const scheduleEndpointSave = (q: string, hdrs: Record<string, string>, a: GraphQLAuth): void => {
    if (endpointTimerRef.current) clearTimeout(endpointTimerRef.current)
    endpointTimerRef.current = setTimeout(() => saveEndpointData(q, hdrs, a), 800)
  }

  const autoSaveCase = useCallback(
    (vars: string): void => {
      if (!project || !endpoint || tab.type !== 'case') return
      const filePath = path.join(project.projectDir, endpoint.casesDir, tab.caseName)
      window.reqstraApi.writeCase(filePath, serializeCaseFile(vars)).catch(console.error)
    },
    [project, endpoint, tab],
  )

  const handleQueryChange = (v: string): void => {
    setQuery(v)
    scheduleEndpointSave(v, headers, auth)
  }
  const handleVariablesChange = (v: string): void => {
    setVariablesJson(v)
    autoSaveCase(v)
  }
  const handleHeadersChange = (v: Record<string, string>): void => {
    setHeaders(v)
    scheduleEndpointSave(query, v, auth)
  }
  const handleAuthChange = (v: GraphQLAuth): void => {
    setAuth(v)
    scheduleEndpointSave(query, headers, v)
  }

  const handleSave = async (): Promise<void> => {
    const rawName = saveNameInput.trim()
    if (!rawName || !project || !endpoint) return
    setSaveError(null)
    const caseName = rawName.endsWith('.yaml') ? rawName : `${rawName}.yaml`
    const filePath = path.join(project.projectDir, endpoint.casesDir, caseName)

    setIsSaving(true)
    try {
      await window.reqstraApi.writeCase(filePath, serializeCaseFile(variablesJson))
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
    if (!project || !endpoint || !collection || !activeTarget) {
      setResponse({
        status: 'ERROR',
        data: null,
        errors: [],
        httpStatus: 0,
        durationMs: 0,
        error: 'GraphQL ターゲットが設定されていません',
      })
      return
    }

    const params: GraphQLRequestParams = {
      url: activeTarget.url,
      query,
      variables: variablesJson,
      headers,
      auth,
    }

    setIsLoading(true)
    try {
      const result = await window.reqstraApi.graphqlRequest(params)
      setResponse(result)

      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        protocol: 'graphql',
        collectionName: collection.name,
        endpointName: endpoint.name,
        caseName: tab.type === 'case' ? tab.caseName : '(scratch)',
        status: result.status,
        durationMs: result.durationMs,
        request: query,
        response: result.data,
      }
      window.reqstraApi.writeLog(project.projectDir, logEntry).catch(console.error)
    } catch (e) {
      setResponse({
        status: 'ERROR',
        data: null,
        errors: [],
        httpStatus: 0,
        durationMs: 0,
        error: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleIntrospect = async (): Promise<void> => {
    if (!activeTarget) return
    setIsLoading(true)
    try {
      const schemaJson = await window.reqstraApi.graphqlIntrospect(
        activeTarget.url,
        headers,
        auth,
      )
      setResponse({
        status: 'OK',
        data: JSON.parse(schemaJson) as unknown,
        errors: [],
        httpStatus: 200,
        durationMs: 0,
      })
    } catch (e) {
      setResponse({
        status: 'ERROR',
        data: null,
        errors: [],
        httpStatus: 0,
        durationMs: 0,
        error: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
        <span className="rounded bg-[#e535ab]/20 px-2 py-0.5 text-xs font-medium text-[#e535ab]">
          GraphQL
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
          type="button"
          onClick={() => void handleIntrospect()}
          disabled={isLoading || !activeTarget}
          className="rounded bg-[#3c3c3c] px-3 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
        >
          Introspect
        </button>
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={isLoading || !!queryError || !query.trim()}
          className="rounded bg-[#0e639c] px-4 py-1 text-xs text-white hover:bg-[#1177bb] disabled:opacity-50"
        >
          ▶ Send
        </button>
      </div>

      {/* 本体: 左右分割 */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanes
          defaultLeftWidth={480}
          minLeft={200}
          minRight={200}
          storageKey="pane-gql-response-width"
        >
          <QueryEditor
            query={query}
            variablesJson={variablesJson}
            headers={headers}
            auth={auth}
            queryError={queryError}
            onQueryChange={handleQueryChange}
            onVariablesChange={handleVariablesChange}
            onHeadersChange={handleHeadersChange}
            onAuthChange={handleAuthChange}
          />
          <ResponseViewer response={response} isLoading={isLoading} />
        </ResizablePanes>
      </div>
    </div>
  )
}
