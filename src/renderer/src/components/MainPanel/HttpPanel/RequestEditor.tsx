import { useState, type JSX } from 'react'
import { MonacoEditor } from '../../shared/MonacoEditor'
import { MetadataEditor } from '../GrpcPanel/MetadataEditor'
import type { HttpMethod, HttpBodyType, GraphQLAuth } from '../../../../../shared/types/project'

type BottomTab = 'body' | 'path-params' | 'headers' | 'auth'

interface Props {
  method: HttpMethod
  path: string
  bodyType: HttpBodyType
  body: string
  queryParams: Record<string, string>
  pathParams: Record<string, string>
  headers: Record<string, string>
  auth: GraphQLAuth
  onMethodChange: (v: HttpMethod) => void
  onPathChange: (v: string) => void
  onBodyTypeChange: (v: HttpBodyType) => void
  onBodyChange: (v: string) => void
  onQueryParamsChange: (v: Record<string, string>) => void
  onPathParamsChange: (v: Record<string, string>) => void
  onHeadersChange: (v: Record<string, string>) => void
  onAuthChange: (v: GraphQLAuth) => void
}

function extractPathParamKeys(path: string): string[] {
  return [...path.matchAll(/:([^/]+)/g)].map((m) => m[1])
}

function methodColor(method: HttpMethod): string {
  switch (method) {
    case 'GET': return 'text-[#4ec9b0]'
    case 'POST': return 'text-[#4fc1ff]'
    case 'PUT': return 'text-[#dcdcaa]'
    case 'PATCH': return 'text-[#ce9178]'
    case 'DELETE': return 'text-[var(--color-error)]'
  }
}

export function RequestEditor({
  method,
  path,
  bodyType,
  body,
  queryParams,
  pathParams,
  headers,
  auth,
  onMethodChange,
  onPathChange,
  onBodyTypeChange,
  onBodyChange,
  onQueryParamsChange,
  onPathParamsChange,
  onHeadersChange,
  onAuthChange,
}: Props): JSX.Element {
  const [bottomTab, setBottomTab] = useState<BottomTab>('body')

  const pathParamKeys = extractPathParamKeys(path)
  const hasPathParams = pathParamKeys.length > 0

  const handlePathParamChange = (key: string, value: string): void => {
    onPathParamsChange({ ...pathParams, [key]: value })
  }

  const tabs: { id: BottomTab; label: string; show: boolean }[] = [
    { id: 'body', label: bodyType === 'json' ? 'Body' : 'Query Params', show: true },
    { id: 'path-params', label: 'Path Params', show: hasPathParams },
    { id: 'headers', label: 'Headers', show: true },
    { id: 'auth', label: 'Auth', show: true },
  ]

  return (
    <div className="flex h-full flex-col">
      {/* URL バー（コレクション設定） */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
        <select
          value={method}
          onChange={(e) => onMethodChange(e.target.value as HttpMethod)}
          className={`w-24 rounded bg-[#3c3c3c] px-2 py-1 text-xs font-medium outline-none ${methodColor(method)}`}
        >
          {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as HttpMethod[]).map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <input
          type="text"
          value={path}
          onChange={(e) => onPathChange(e.target.value)}
          placeholder="/users/:id"
          className="flex-1 rounded bg-[#3c3c3c] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-[var(--color-text-accent)]"
        />
        <select
          value={bodyType}
          onChange={(e) => onBodyTypeChange(e.target.value as HttpBodyType)}
          className="w-32 rounded bg-[#3c3c3c] px-2 py-1 text-xs text-[var(--color-text-secondary)] outline-none"
        >
          <option value="json">JSON Body</option>
          <option value="query">Query Params</option>
        </select>
      </div>

      {/* タブエリア */}
      <div className="flex border-b border-[var(--color-border)] px-3 text-xs">
        {tabs.filter((t) => t.show).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setBottomTab(tab.id)}
            className={`mr-4 py-1 ${
              bottomTab === tab.id
                ? 'border-b-2 border-[var(--color-text-accent)] text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* タブコンテンツ */}
      <div className="flex-1 overflow-hidden">
        {bottomTab === 'body' && bodyType === 'json' && (
          <MonacoEditor
            value={body}
            onChange={(v) => onBodyChange(v ?? '')}
            language="json"
          />
        )}
        {bottomTab === 'body' && bodyType === 'query' && (
          <MetadataEditor metadata={queryParams} onChange={onQueryParamsChange} />
        )}
        {bottomTab === 'path-params' && hasPathParams && (
          <div className="space-y-1 p-3 text-xs">
            {pathParamKeys.map((key) => (
              <div key={key} className="flex items-center gap-2">
                <span className="w-32 shrink-0 font-mono text-[var(--color-text-accent)]">:{key}</span>
                <input
                  value={pathParams[key] ?? ''}
                  onChange={(e) => handlePathParamChange(key, e.target.value)}
                  placeholder={`${key} の値`}
                  className="flex-1 rounded bg-[#3c3c3c] px-2 py-1 text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-[var(--color-text-accent)]"
                />
              </div>
            ))}
          </div>
        )}
        {bottomTab === 'headers' && (
          <MetadataEditor metadata={headers} onChange={onHeadersChange} />
        )}
        {bottomTab === 'auth' && (
          <AuthEditor auth={auth} onChange={onAuthChange} />
        )}
      </div>
    </div>
  )
}

interface AuthEditorProps {
  auth: GraphQLAuth
  onChange: (auth: GraphQLAuth) => void
}

function AuthEditor({ auth, onChange }: AuthEditorProps): JSX.Element {
  return (
    <div className="space-y-2 p-3 text-xs">
      <div className="flex items-center gap-2">
        <label className="w-20 shrink-0 text-[var(--color-text-secondary)]">タイプ</label>
        <select
          value={auth.type}
          onChange={(e) => onChange({ type: e.target.value as GraphQLAuth['type'] })}
          className="rounded bg-[#3c3c3c] px-2 py-1 text-[var(--color-text-primary)] outline-none"
        >
          <option value="none">None</option>
          <option value="bearer">Bearer Token</option>
          <option value="basic">Basic Auth</option>
          <option value="oauth2">OAuth2</option>
        </select>
      </div>

      {(auth.type === 'bearer' || auth.type === 'oauth2') && (
        <div className="flex items-center gap-2">
          <label className="w-20 shrink-0 text-[var(--color-text-secondary)]">Token</label>
          <input
            type="text"
            value={auth.token ?? ''}
            onChange={(e) => onChange({ ...auth, token: e.target.value })}
            placeholder="your-token"
            className="flex-1 rounded bg-[#3c3c3c] px-2 py-1 text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-[var(--color-text-accent)]"
          />
        </div>
      )}

      {auth.type === 'basic' && (
        <>
          <div className="flex items-center gap-2">
            <label className="w-20 shrink-0 text-[var(--color-text-secondary)]">Username</label>
            <input
              type="text"
              value={auth.username ?? ''}
              onChange={(e) => onChange({ ...auth, username: e.target.value })}
              placeholder="username"
              className="flex-1 rounded bg-[#3c3c3c] px-2 py-1 text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-[var(--color-text-accent)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="w-20 shrink-0 text-[var(--color-text-secondary)]">Password</label>
            <input
              type="password"
              value={auth.password ?? ''}
              onChange={(e) => onChange({ ...auth, password: e.target.value })}
              placeholder="password"
              className="flex-1 rounded bg-[#3c3c3c] px-2 py-1 text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-[var(--color-text-accent)]"
            />
          </div>
        </>
      )}
    </div>
  )
}
