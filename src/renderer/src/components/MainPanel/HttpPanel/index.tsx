import { useState, useEffect, useCallback, useRef, type JSX } from 'react'
import * as yaml from 'yaml'
import { RequestEditor } from './RequestEditor'
import { ResponseViewer } from './ResponseViewer'
import { ResizablePanes } from '../../shared/ResizablePanes'
import { useAppStore, type Tab } from '../../../store/appStore'
import { useProjectStore } from '../../../store/projectStore'
import type { HttpResponse, HttpRequestParams, LogEntry } from '../../../../../shared/types/ipc'
import type { HttpTarget, HttpEndpoint, HttpMethod, HttpBodyType, GraphQLAuth } from '../../../../../shared/types/project'
import * as path from 'path'

interface Props {
  tab: Tab
}

const DEFAULT_AUTH: GraphQLAuth = { type: 'none' }

function parseHttpCaseFile(raw: string): {
  body: string
  pathParams: Record<string, string>
  queryParams: Record<string, string>
} {
  if (!raw.trim()) return { body: '', pathParams: {}, queryParams: {} }
  try {
    const parsed = yaml.parse(raw) as Record<string, unknown>
    const body = typeof parsed.body === 'string' ? parsed.body : ''
    const pathParams =
      typeof parsed.pathParams === 'object' && parsed.pathParams !== null
        ? (parsed.pathParams as Record<string, string>)
        : {}
    const queryParams =
      typeof parsed.params === 'object' && parsed.params !== null
        ? (parsed.params as Record<string, string>)
        : {}
    return { body, pathParams, queryParams }
  } catch {
    return { body: '', pathParams: {}, queryParams: {} }
  }
}

function serializeHttpCaseFile(
  body: string,
  queryParams: Record<string, string>,
  pathParams: Record<string, string>,
  bodyType: HttpBodyType,
): string {
  const obj: Record<string, unknown> = {}
  if (bodyType === 'json' && body.trim()) obj.body = body
  if (bodyType === 'query' && Object.keys(queryParams).length > 0) obj.params = queryParams
  if (Object.keys(pathParams).length > 0) obj.pathParams = pathParams
  return yaml.stringify(obj)
}

export function HttpPanel({ tab }: Props): JSX.Element {
  const project = useProjectStore((s) => s.project)
  const updateEndpoint = useProjectStore((s) => s.updateEndpoint)
  const activeEnvironmentId = useAppStore((s) => s.activeEnvironmentId)
  const activeProtocolTargetId = useAppStore((s) => s.activeProtocolTargetId)
  const setSaveStatus = useAppStore((s) => s.setSaveStatus)

  const endpoint = project?.collections
    .flatMap((c) => c.endpoints as HttpEndpoint[])
    .find((ep) => ep.id === tab.endpointId)

  const collection = project?.collections.find((c) =>
    (c.endpoints as HttpEndpoint[]).some((ep) => ep.id === tab.endpointId),
  )

  const activeEnv =
    project?.environments.find((e) => e.id === activeEnvironmentId) ?? project?.environments[0]
  const httpTargets = (activeEnv?.protocols?.http as HttpTarget[] | undefined) ?? []
  const activeTarget =
    httpTargets.find((t) => t.id === activeProtocolTargetId) ?? httpTargets[0]

  const endpointLabel = activeTarget?.baseUrl
    ? `${activeTarget.baseUrl}${endpoint?.path ?? ''}`
    : '(ターゲット未設定)'

  const [method, setMethod] = useState<HttpMethod>(endpoint?.method ?? 'GET')
  const [epPath, setEpPath] = useState<string>(endpoint?.path ?? '/')
  const [bodyType, setBodyType] = useState<HttpBodyType>(endpoint?.bodyType ?? 'json')
  const [headers, setHeaders] = useState<Record<string, string>>(endpoint?.headers ?? {})
  const [auth, setAuth] = useState<GraphQLAuth>(endpoint?.auth ?? DEFAULT_AUTH)

  const [body, setBody] = useState<string>('')
  const [queryParams, setQueryParams] = useState<Record<string, string>>({})
  const [pathParams, setPathParams] = useState<Record<string, string>>({})

  const [response, setResponse] = useState<HttpResponse | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const endpointTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setMethod(endpoint?.method ?? 'GET')
    setEpPath(endpoint?.path ?? '/')
    setBodyType(endpoint?.bodyType ?? 'json')
    setHeaders(endpoint?.headers ?? {})
    setAuth(endpoint?.auth ?? DEFAULT_AUTH)
  }, [endpoint?.id])

  useEffect(() => {
    if (!project || !endpoint || tab.type !== 'case') {
      setBody('')
      setQueryParams({})
      setPathParams({})
      return
    }
    const filePath = path.join(project.projectDir, endpoint.casesDir, tab.caseName)
    window.reqstraApi
      .readCase(filePath)
      .then((raw) => {
        const parsed = parseHttpCaseFile(raw)
        setBody(parsed.body)
        setQueryParams(parsed.queryParams)
        setPathParams(parsed.pathParams)
      })
      .catch(() => {
        setBody('')
        setQueryParams({})
        setPathParams({})
      })
  }, [tab.id, project?.projectDir, endpoint?.id])

  const saveEndpointData = useCallback(
    (m: HttpMethod, p: string, bt: HttpBodyType, hdrs: Record<string, string>, a: GraphQLAuth): void => {
      if (!endpoint || !collection) return
      const updatedEndpoint: HttpEndpoint = {
        ...endpoint,
        method: m,
        path: p,
        bodyType: bt,
        headers: hdrs,
        auth: a,
      }
      updateEndpoint(collection.id, updatedEndpoint)
      const proj = useProjectStore.getState().project
      if (!proj) return
      const label = collection.name
      setSaveStatus('saving', label)
      window.reqstraApi
        .saveProject(proj)
        .then(() => {
          setSaveStatus('saved', label)
          if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
          savedTimerRef.current = setTimeout(() => setSaveStatus('idle', null), 2000)
        })
        .catch(console.error)
    },
    [endpoint, collection, updateEndpoint, setSaveStatus],
  )

  const scheduleEndpointSave = (
    m: HttpMethod,
    p: string,
    bt: HttpBodyType,
    hdrs: Record<string, string>,
    a: GraphQLAuth,
  ): void => {
    if (endpointTimerRef.current) clearTimeout(endpointTimerRef.current)
    endpointTimerRef.current = setTimeout(() => saveEndpointData(m, p, bt, hdrs, a), 800)
  }

  const autoSaveCase = useCallback(
    (b: string, qp: Record<string, string>, pp: Record<string, string>, bt: HttpBodyType): void => {
      if (!project || !endpoint || tab.type !== 'case') return
      const filePath = path.join(project.projectDir, endpoint.casesDir, tab.caseName)
      const label = tab.caseName.replace(/\.ya?ml$/, '')
      setSaveStatus('saving', label)
      window.reqstraApi
        .writeCase(filePath, serializeHttpCaseFile(b, qp, pp, bt))
        .then(() => {
          setSaveStatus('saved', label)
          if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
          savedTimerRef.current = setTimeout(() => setSaveStatus('idle', null), 2000)
        })
        .catch(console.error)
    },
    [project, endpoint, tab, setSaveStatus],
  )

  const handleMethodChange = (v: HttpMethod): void => {
    setMethod(v)
    scheduleEndpointSave(v, epPath, bodyType, headers, auth)
  }
  const handlePathChange = (v: string): void => {
    setEpPath(v)
    scheduleEndpointSave(method, v, bodyType, headers, auth)
  }
  const handleBodyTypeChange = (v: HttpBodyType): void => {
    setBodyType(v)
    scheduleEndpointSave(method, epPath, v, headers, auth)
  }
  const handleHeadersChange = (v: Record<string, string>): void => {
    setHeaders(v)
    scheduleEndpointSave(method, epPath, bodyType, v, auth)
  }
  const handleAuthChange = (v: GraphQLAuth): void => {
    setAuth(v)
    scheduleEndpointSave(method, epPath, bodyType, headers, v)
  }
  const handleBodyChange = (v: string): void => {
    setBody(v)
    autoSaveCase(v, queryParams, pathParams, bodyType)
  }
  const handleQueryParamsChange = (v: Record<string, string>): void => {
    setQueryParams(v)
    autoSaveCase(body, v, pathParams, bodyType)
  }
  const handlePathParamsChange = (v: Record<string, string>): void => {
    setPathParams(v)
    autoSaveCase(body, queryParams, v, bodyType)
  }

  const handleSend = async (): Promise<void> => {
    if (!project || !endpoint || !collection || !activeTarget) {
      setResponse({
        status: 'ERROR',
        body: '',
        httpStatus: 0,
        durationMs: 0,
        error: 'HTTP ターゲットが設定されていません',
      })
      return
    }

    const params: HttpRequestParams = {
      baseUrl: activeTarget.baseUrl,
      method,
      path: epPath,
      pathParams,
      headers,
      auth,
      bodyType,
      body,
      queryParams,
    }

    setIsLoading(true)
    try {
      const result = await window.reqstraApi.httpRequest(params)
      setResponse(result)

      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        protocol: 'http',
        collectionName: collection.name,
        endpointName: endpoint.name,
        caseName: tab.type === 'case' ? tab.caseName : '(scratch)',
        status: result.status,
        durationMs: result.durationMs,
        request: { method, path: epPath, body, queryParams, pathParams },
        response: result.body,
      }
      window.reqstraApi.writeLog(project.projectDir, logEntry).catch(console.error)
    } catch (e) {
      setResponse({
        status: 'ERROR',
        body: '',
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
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
        <span className="rounded bg-[#0e639c]/20 px-2 py-0.5 text-xs font-medium text-[#4fc1ff]">
          HTTP
        </span>
        <span className="flex-1 truncate text-xs text-[var(--color-text-secondary)]">
          {endpointLabel}
        </span>
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={isLoading}
          className="rounded bg-[#0e639c] px-4 py-1 text-xs text-white hover:bg-[#1177bb] disabled:opacity-50"
        >
          ▶ Send
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <ResizablePanes
          defaultLeftWidth={480}
          minLeft={200}
          minRight={200}
          storageKey="pane-http-response-width"
        >
          <RequestEditor
            method={method}
            path={epPath}
            bodyType={bodyType}
            body={body}
            queryParams={queryParams}
            pathParams={pathParams}
            headers={headers}
            auth={auth}
            onMethodChange={handleMethodChange}
            onPathChange={handlePathChange}
            onBodyTypeChange={handleBodyTypeChange}
            onBodyChange={handleBodyChange}
            onQueryParamsChange={handleQueryParamsChange}
            onPathParamsChange={handlePathParamsChange}
            onHeadersChange={handleHeadersChange}
            onAuthChange={handleAuthChange}
          />
          <ResponseViewer response={response} isLoading={isLoading} />
        </ResizablePanes>
      </div>
    </div>
  )
}
