import { useState } from 'react'
import { cn } from '@vibed/ui'
import { Search, Plus, ChevronRight, Terminal as TerminalIcon, Coins } from 'lucide-react'
import { PreviewPanel } from '../preview/PreviewPanel'
import { TokenPanel } from '../token/TokenPanel'

type TopTab = 'changes' | 'files' | 'checks' | 'preview'
type BottomTab = 'terminal' | 'token'

// Mock changed files data - in real app this would come from git
const MOCK_CHANGES = [
  { path: 'apps/web/package.json', additions: 5, deletions: 0 },
  { path: 'apps/web/src/compon...ConnectButton.tsx', additions: 17, deletions: 21 },
  { path: 'apps/web/src/components/...WalletMenu.tsx', additions: 3, deletions: 1 },
  { path: 'apps/web/src/components/c...ChatArea.tsx', additions: 27, deletions: 1 },
  { path: 'apps/web/src/components/...ChatInput.tsx', additions: 38, deletions: 37 },
  { path: 'apps/web/src/compo...WelcomeScreen.tsx', additions: 4, deletions: 94 },
  { path: 'apps/web/src/components/lay...Layout.tsx', additions: 9, deletions: 64 },
  { path: 'apps/web/src/index.css', additions: 0, deletions: 0 },
  { path: 'apps/web/src/pages/DiscoveryPage.tsx', additions: 29, deletions: 139 },
  { path: 'apps/web/src/stores/projectStore.ts', additions: 79, deletions: 0 },
  { path: 'packages/ui/src/animations/variants.ts', additions: 0, deletions: 0 },
  { path: 'packages/ui/src/index.ts', additions: 1, deletions: 0 },
]

function FileChangeItem({ file }: { file: typeof MOCK_CHANGES[0] }) {
  const fileName = file.path.split('/').pop() || file.path

  return (
    <button className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 transition-colors text-left group">
      <ChevronRight size={12} className="text-neutral-600 group-hover:text-neutral-400" />
      <span className="flex-1 text-sm text-neutral-300 truncate" title={file.path}>
        {fileName}
      </span>
      <div className="flex items-center gap-1 text-xs">
        {file.additions > 0 && (
          <span className="text-emerald-400">+{file.additions}</span>
        )}
        {file.deletions > 0 && (
          <span className="text-red-400">-{file.deletions}</span>
        )}
      </div>
    </button>
  )
}

function ChangesPanel() {
  const totalChanges = MOCK_CHANGES.length

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 py-2 border-b border-white/10">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Search files..."
            className="w-full bg-neutral-800 border border-white/10 rounded pl-7 pr-3 py-1.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/20"
          />
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {MOCK_CHANGES.map((file, idx) => (
          <FileChangeItem key={idx} file={file} />
        ))}
      </div>

      {/* Summary */}
      <div className="px-3 py-2 border-t border-white/10 text-xs text-neutral-500">
        {totalChanges} files changed
      </div>
    </div>
  )
}

function TerminalPanel() {
  return (
    <div className="h-full bg-neutral-950 font-mono text-sm p-3">
      <div className="text-neutral-400">
        <span className="text-emerald-400">user</span>
        <span className="text-neutral-600">@</span>
        <span className="text-cyan-400">vibed</span>
        <span className="text-neutral-600">:</span>
        <span className="text-blue-400">~/project</span>
        <span className="text-neutral-400"> $ </span>
        <span className="animate-pulse">▋</span>
      </div>
    </div>
  )
}

export function RightPanel() {
  const [topTab, setTopTab] = useState<TopTab>('changes')
  const [bottomTab, setBottomTab] = useState<BottomTab>('terminal')

  const topTabs: { id: TopTab; label: string; count?: number }[] = [
    { id: 'changes', label: 'Changes', count: MOCK_CHANGES.length },
    { id: 'files', label: 'All files' },
    { id: 'checks', label: 'Checks' },
    { id: 'preview', label: 'Preview' },
  ]

  const bottomTabs: { id: BottomTab; label: string; icon: React.ReactNode }[] = [
    { id: 'terminal', label: 'Terminal', icon: <TerminalIcon size={14} /> },
    { id: 'token', label: 'Token', icon: <Coins size={14} /> },
  ]

  return (
    <div className="flex flex-col h-full bg-neutral-900">
      {/* Top Section */}
      <div className="flex-[6] min-h-0 flex flex-col border-b border-white/10">
        {/* Top Tabs */}
        <div className="flex items-center gap-1 px-2 py-1 border-b border-white/10 bg-neutral-900">
          {topTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTopTab(tab.id)}
              className={cn(
                'px-2 py-1 rounded text-xs font-medium transition-colors',
                topTab === tab.id
                  ? 'bg-white/10 text-white'
                  : 'text-neutral-500 hover:text-white hover:bg-white/5'
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1 text-neutral-400">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Top Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {topTab === 'changes' && <ChangesPanel />}
          {topTab === 'files' && (
            <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
              All files view
            </div>
          )}
          {topTab === 'checks' && (
            <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
              No checks configured
            </div>
          )}
          {topTab === 'preview' && <PreviewPanel />}
        </div>
      </div>

      {/* Bottom Section */}
      <div className="flex-[4] min-h-0 flex flex-col">
        {/* Bottom Tabs */}
        <div className="flex items-center justify-between px-2 py-1 border-b border-white/10 bg-neutral-900">
          <div className="flex items-center gap-1">
            {bottomTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setBottomTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors',
                  bottomTab === tab.id
                    ? 'bg-white/10 text-white'
                    : 'text-neutral-500 hover:text-white hover:bg-white/5'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          <button className="p-1 rounded hover:bg-white/10 text-neutral-500 hover:text-white transition-colors">
            <Plus size={14} />
          </button>
        </div>

        {/* Bottom Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {bottomTab === 'terminal' && <TerminalPanel />}
          {bottomTab === 'token' && <TokenPanel />}
        </div>
      </div>
    </div>
  )
}
