import { useEffect } from 'react'
import { ChatArea } from '../components/chat/ChatArea'
import { RightPanel } from '../components/ide/RightPanel'
import { useProjectStore } from '../stores/projectStore'
import { useChatStore } from '../stores/chatStore'

export function IDEPage() {
  const { currentProject, setCurrentProject, addProject, addWorkspace, setCurrentWorkspace } = useProjectStore()
  const { setProjectId } = useChatStore()

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

  return (
    <div className="flex h-full">
      {/* Chat Section */}
      <div className="flex-1 min-w-0">
        <ChatArea />
      </div>

      {/* Right Panel - Changes/Preview + Terminal/Token */}
      <div className="w-[400px] border-l border-white/10">
        <RightPanel />
      </div>
    </div>
  )
}
