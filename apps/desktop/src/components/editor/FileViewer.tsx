import { Loader2, AlertCircle } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { EditorTab } from '../../stores/editorStore'

interface FileViewerProps {
  tab: EditorTab
}

// Map our language names to Prism language names
function mapLanguage(language: string): string {
  const languageMap: Record<string, string> = {
    typescript: 'tsx',
    javascript: 'jsx',
    rust: 'rust',
    python: 'python',
    json: 'json',
    toml: 'toml',
    yaml: 'yaml',
    markdown: 'markdown',
    html: 'markup',
    css: 'css',
    scss: 'scss',
    sql: 'sql',
    bash: 'bash',
    go: 'go',
    java: 'java',
    kotlin: 'kotlin',
    swift: 'swift',
    c: 'c',
    cpp: 'cpp',
    xml: 'markup',
    svg: 'markup',
    plaintext: 'text',
  }
  return languageMap[language] || 'text'
}

// Custom style based on oneDark but with our background
const customStyle = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    background: 'transparent',
    margin: 0,
    padding: 0,
    fontSize: '13px',
    lineHeight: '1.5',
  },
  'code[class*="language-"]': {
    ...oneDark['code[class*="language-"]'],
    background: 'transparent',
    fontSize: '13px',
    lineHeight: '1.5',
  },
}

export function FileViewer({ tab }: FileViewerProps) {
  if (tab.isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-neutral-950">
        <div className="flex items-center gap-2 text-neutral-500">
          <Loader2 size={20} className="animate-spin" />
          <span>Loading file...</span>
        </div>
      </div>
    )
  }

  if (tab.error) {
    return (
      <div className="flex items-center justify-center h-full bg-neutral-950">
        <div className="flex flex-col items-center gap-2 text-red-400">
          <AlertCircle size={32} />
          <span className="text-sm">{tab.error}</span>
        </div>
      </div>
    )
  }

  if (!tab.content) {
    return (
      <div className="flex items-center justify-center h-full bg-neutral-950 text-neutral-500">
        No content
      </div>
    )
  }

  const lines = tab.content.split('\n')
  const prismLanguage = mapLanguage(tab.language || 'plaintext')

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      {/* Code area */}
      <div className="flex-1 overflow-auto">
        <SyntaxHighlighter
          language={prismLanguage}
          style={customStyle}
          showLineNumbers
          lineNumberStyle={{
            minWidth: '3em',
            paddingRight: '1em',
            paddingLeft: '1em',
            color: '#6e7681',
            textAlign: 'right',
            userSelect: 'none',
            borderRight: '1px solid rgba(255,255,255,0.1)',
            marginRight: '1em',
          }}
          customStyle={{
            margin: 0,
            padding: '0.5rem 0',
            background: 'transparent',
            fontSize: '13px',
          }}
          codeTagProps={{
            style: {
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
            },
          }}
        >
          {tab.content}
        </SyntaxHighlighter>
      </div>

      {/* File info footer */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-neutral-900 border-t border-white/10 text-xs text-neutral-500">
        <span className="truncate" title={tab.filePath}>{tab.filePath}</span>
        <div className="flex items-center gap-4 flex-shrink-0">
          <span className="capitalize">{tab.language}</span>
          <span>{lines.length} lines</span>
        </div>
      </div>
    </div>
  )
}
