import { useEffect } from 'react'
import { ChatArea } from '../components/chat/ChatArea'
import { PreviewPanel } from '../components/preview/PreviewPanel'
import { TokenPanel } from '../components/token/TokenPanel'
import { useProjectStore } from '../stores/projectStore'
import { useChatStore } from '../stores/chatStore'

export function IDEPage() {
  const { currentProject, setCurrentProject, addProject } = useProjectStore()
  const { setProjectId } = useChatStore()

  // Auto-create a demo project if none exists
  useEffect(() => {
    if (!currentProject) {
      const demoProject = {
        id: crypto.randomUUID(),
        name: 'New Project',
        status: 'draft' as const,
      }
      addProject(demoProject)
      setCurrentProject(demoProject)
      setProjectId(demoProject.id)
    }
  }, [currentProject, addProject, setCurrentProject, setProjectId])

  return (
    <div className="flex h-full">
      {/* Chat Section */}
      <div className="flex-1 min-w-0">
        <ChatArea />
      </div>

      {/* Right Panel - Preview + Token */}
      <div className="w-[400px] border-l border-border flex flex-col">
        {/* Preview Panel - Takes 60% */}
        <div className="flex-[6] min-h-0 border-b border-border">
          <PreviewPanel />
        </div>

        {/* Token Panel - Takes 40% */}
        <div className="flex-[4] min-h-0 overflow-hidden">
          <TokenPanel />
        </div>
      </div>
    </div>
  )
}
