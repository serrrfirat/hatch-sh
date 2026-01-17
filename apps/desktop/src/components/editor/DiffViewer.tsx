import { Loader2, AlertCircle, Plus, Minus } from 'lucide-react'
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued'
import type { EditorTab } from '../../stores/editorStore'

interface DiffViewerProps {
  tab: EditorTab
}

// Custom styles for the diff viewer matching our dark theme
const diffStyles = {
  variables: {
    dark: {
      diffViewerBackground: '#0d1117',
      diffViewerColor: '#c9d1d9',
      addedBackground: '#12261e',
      addedColor: '#7ee787',
      removedBackground: '#2d1215',
      removedColor: '#f85149',
      wordAddedBackground: '#1f6b3d',
      wordRemovedBackground: '#8e1519',
      addedGutterBackground: '#1a4d2e',
      removedGutterBackground: '#4d1c20',
      gutterBackground: '#161b22',
      gutterBackgroundDark: '#0d1117',
      highlightBackground: '#2f3542',
      highlightGutterBackground: '#2f3542',
      codeFoldGutterBackground: '#161b22',
      codeFoldBackground: '#161b22',
      emptyLineBackground: '#0d1117',
      gutterColor: '#6e7681',
      addedGutterColor: '#7ee787',
      removedGutterColor: '#f85149',
      codeFoldContentColor: '#8b949e',
      diffViewerTitleBackground: '#161b22',
      diffViewerTitleColor: '#c9d1d9',
      diffViewerTitleBorderColor: '#30363d',
    },
  },
  line: {
    padding: '2px 10px',
    '&:hover': {
      background: '#1c2128',
    },
  },
  contentText: {
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    fontSize: '13px',
    lineHeight: '1.5',
  },
  gutter: {
    minWidth: '40px',
    padding: '0 10px',
    '&:hover': {
      cursor: 'pointer',
    },
  },
  marker: {
    padding: '0 6px',
  },
  titleBlock: {
    padding: '8px 10px',
    borderBottom: '1px solid #30363d',
  },
  content: {
    width: '100%',
  },
}

export function DiffViewer({ tab }: DiffViewerProps) {
  if (tab.isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0d1117]">
        <div className="flex items-center gap-2 text-neutral-500">
          <Loader2 size={20} className="animate-spin" />
          <span>Loading diff...</span>
        </div>
      </div>
    )
  }

  if (tab.error) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0d1117]">
        <div className="flex flex-col items-center gap-2 text-red-400">
          <AlertCircle size={32} />
          <span className="text-sm">{tab.error}</span>
        </div>
      </div>
    )
  }

  const oldContent = tab.oldContent || ''
  const newContent = tab.newContent || ''

  // Count additions and deletions
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  const additions = Math.max(0, newLines.length - oldLines.length)
  const deletions = Math.max(0, oldLines.length - newLines.length)

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      {/* Header showing file status */}
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-900 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-300 font-medium">{tab.filePath}</span>
          {tab.isNewFile && (
            <span className="px-2 py-0.5 text-xs rounded bg-emerald-900/50 text-emerald-400 border border-emerald-700/50">
              New file
            </span>
          )}
          {tab.isDeleted && (
            <span className="px-2 py-0.5 text-xs rounded bg-red-900/50 text-red-400 border border-red-700/50">
              Deleted
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          {!tab.isNewFile && !tab.isDeleted && (
            <>
              <span className="flex items-center gap-1 text-emerald-400">
                <Plus size={12} />
                {additions}
              </span>
              <span className="flex items-center gap-1 text-red-400">
                <Minus size={12} />
                {deletions}
              </span>
            </>
          )}
          <span className="text-neutral-500 capitalize">{tab.language}</span>
        </div>
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-auto">
        {tab.isNewFile ? (
          // For new files, show all lines as additions
          <div className="p-4">
            <div className="text-xs text-emerald-400 mb-2 flex items-center gap-2">
              <Plus size={14} />
              <span>New file with {newLines.length} lines</span>
            </div>
            <pre className="text-sm text-emerald-300 font-mono whitespace-pre-wrap bg-emerald-900/20 p-4 rounded border border-emerald-700/30">
              {newContent}
            </pre>
          </div>
        ) : tab.isDeleted ? (
          // For deleted files, show all lines as deletions
          <div className="p-4">
            <div className="text-xs text-red-400 mb-2 flex items-center gap-2">
              <Minus size={14} />
              <span>Deleted file with {oldLines.length} lines</span>
            </div>
            <pre className="text-sm text-red-300 font-mono whitespace-pre-wrap bg-red-900/20 p-4 rounded border border-red-700/30">
              {oldContent}
            </pre>
          </div>
        ) : oldContent === newContent ? (
          // No changes
          <div className="flex items-center justify-center h-full text-neutral-500">
            No changes in this file
          </div>
        ) : (
          // Show unified diff view with collapsed unchanged sections
          <ReactDiffViewer
            oldValue={oldContent}
            newValue={newContent}
            splitView={false}
            useDarkTheme={true}
            compareMethod={DiffMethod.WORDS}
            styles={diffStyles}
            showDiffOnly={true}
            extraLinesSurroundingDiff={3}
          />
        )}
      </div>
    </div>
  )
}
