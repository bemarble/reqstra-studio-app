import type { JSX } from 'react'
import Editor, { loader, type OnChange } from '@monaco-editor/react'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution'
import 'monaco-editor/esm/vs/language/json/monaco.contribution'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'

window.MonacoEnvironment = {
  getWorker(_: unknown, label: string): Worker {
    if (label === 'json') return new jsonWorker()
    return new editorWorker()
  },
}

loader.config({ monaco })

interface Props {
  value: string
  onChange?: OnChange
  language?: string
  readOnly?: boolean
  height?: string
}

export function MonacoEditor({
  value,
  onChange,
  language = 'yaml',
  readOnly = false,
  height = '100%',
}: Props): JSX.Element {
  return (
    <Editor
      height={height}
      language={language}
      value={value}
      onChange={onChange}
      theme="vs-dark"
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        automaticLayout: true,
        padding: { top: 8 },
      }}
    />
  )
}
