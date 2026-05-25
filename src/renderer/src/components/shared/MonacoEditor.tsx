import type { JSX } from 'react'
import Editor, { type OnChange } from '@monaco-editor/react'

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
