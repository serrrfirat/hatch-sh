import { useEffect } from 'react'
import { ChatArea } from '../components/chat/ChatArea'
import { RightPanel } from '../components/ide/RightPanel'
import { useProjectStore } from '../stores/projectStore'
import { useChatStore } from '../stores/chatStore'
import { useEditorStore } from '../stores/editorStore'
import { FileViewer } from '../components/editor/FileViewer'
import { DiffViewer } from '../components/editor/DiffViewer'
import { FileIcon } from '../components/icons/FileIcon'
import { cn } from '@hatch/ui'
import { X, MessageSquare, GitCompare } from 'lucide-react'

export function IDEPage() {
  const { currentProject, setCurrentProject, addProject, addWorkspace, setCurrentWorkspace } = useProjectStore()
  const { setProjectId } = useChatStore()
  const { tabs, activeTabId, setActiveTab, closeTab } = useEditorStore()

  // Auto-create a demo project if none exists
  useEffect(() => {
    if (!currentProject) {
      const projectId = crypto.randomUUID()
      const workspaceId = crypto.randomUUID()

      const demoProject = {
        id: projectId,
        name: 'new-project',
        status: 'draft' as const,
        workspaces: [],
      }

      addProject(demoProject)
      setCurrentProject(demoProject)
      setProjectId(projectId)

      // Add initial workspace
      const workspace = {
        id: workspaceId,
        branchName: 'main',
        location: 'local',
        lastActive: new Date(),
        status: 'working' as const,
      }
      addWorkspace(projectId, workspace)
      setCurrentWorkspace(workspace)
    }
  }, [currentProject, addProject, setCurrentProject, setProjectId, addWorkspace, setCurrentWorkspace])

  const activeTab = tabs.find((t) => t.id === activeTabId)

  return (
    <div className="flex h-full w-full">
      {/* Main Content Section */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tab Bar */}
        <div className="flex items-center gap-1 px-2 py-1 border-b border-white/10 bg-neutral-900 overflow-x-auto flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'group flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors min-w-0 max-w-[200px]',
                activeTabId === tab.id
                  ? 'bg-white/10 text-white'
                  : 'text-neutral-500 hover:text-white hover:bg-white/5'
              )}
            >
              {tab.type === 'chat' ? (
                <MessageSquare size={14} className="flex-shrink-0" />
              ) : tab.type === 'diff' ? (
                <GitCompare size={14} className="flex-shrink-0 text-amber-400" />
              ) : (
                <FileIcon filename={tab.title} className="w-4 h-4 flex-shrink-0" />
              )}
              <span className="truncate">{tab.title}</span>
              {tab.type !== 'chat' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(tab.id)
                  }}
                  className="flex-shrink-0 p-0.5 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab?.type === 'chat' ? (
            <ChatArea />
          ) : activeTab?.type === 'file' ? (
            <FileViewer tab={activeTab} />
          ) : activeTab?.type === 'diff' ? (
            <DiffViewer tab={activeTab} />
          ) : (
            <div className="flex items-center justify-center h-full text-neutral-500">
              Select a tab
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Changes/Preview + Terminal/Token */}
      <div className="w-80 border-l border-white/10 flex-shrink-0">
        <RightPanel />
      </div>
    </div>
  )
}
