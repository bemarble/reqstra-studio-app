import { useState, type JSX } from 'react'
import { parse, print } from 'graphql'
import { MonacoEditor } from '../../shared/MonacoEditor'
import { MetadataEditor } from '../GrpcPanel/MetadataEditor'
import { ResizablePanes } from '../../shared/ResizablePanes'
import type { GraphQLAuth } from '../../../../../shared/types/ipc'

type BottomTab = 'variables' | 'headers' | 'auth'

interface Props {
  query: string
  variablesJson: string
  headers: Record<string, string>
  auth: GraphQLAuth
  queryError: string | null
  onQueryChange: (v: string) => void
  onVariablesChange: (v: string) => void
  onHeadersChange: (v: Record<string, string>) => void
  onAuthChange: (v: GraphQLAuth) => void
}

export function QueryEditor({
  query,
  variablesJson,
  headers,
  auth,
  queryError,
  onQueryChange,
  onVariablesChange,
  onHeadersChange,
  onAuthChange,
}: Props): JSX.Element {
  const [bottomTab, setBottomTab] = useState<BottomTab>('variables')

  const handlePretty = (): void => {
    try {
      onQueryChange(print(parse(query)))
    } catch {
      // パースエラー時は何もしない
    }
  }

  return (
    <ResizablePanes
      direction="vertical"
      defaultLeftWidth={260}
      minLeft={80}
      minRight={120}
      storageKey="pane-gql-query-height"
    >
      {/* 上段: クエリエディタ */}
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-1">
          <span className="text-xs text-[var(--color-text-secondary)]">Query</span>
          <button
            type="button"
            onClick={handlePretty}
            disabled={!!queryError}
            title="クエリを整形"
            className="rounded bg-[#3c3c3c] px-2 py-0.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-40"
          >
            Pretty
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <MonacoEditor value={query} onChange={(v) => onQueryChange(v ?? '')} language="graphql" />
        </div>
        {queryError && (
          <p className="border-t border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-error)]">
            {queryError}
          </p>
        )}
      </div>

      {/* 下段: Variables + [Headers][Auth] タブ */}
      <div className="flex h-full flex-col">
        <div className="flex border-b border-[var(--color-border)] px-3 py-1 text-xs">
          {(['variables', 'headers', 'auth'] as BottomTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setBottomTab(tab)}
              className={`mr-3 capitalize ${
                bottomTab === tab
                  ? 'text-[var(--color-text-primary)]'
                  : 'text-[var(--color-text-secondary)]'
              }`}
            >
              {tab === 'variables' ? 'Variables' : tab === 'headers' ? 'Headers' : 'Auth'}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-hidden">
          {bottomTab === 'variables' && (
            <MonacoEditor
              value={variablesJson}
              onChange={(v) => onVariablesChange(v ?? '')}
              language="json"
            />
          )}
          {bottomTab === 'headers' && (
            <MetadataEditor metadata={headers} onChange={onHeadersChange} />
          )}
          {bottomTab === 'auth' && (
            <AuthEditor auth={auth} onChange={onAuthChange} />
          )}
        </div>
      </div>
    </ResizablePanes>
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
