import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useProjectStore, type Project, type Workspace } from '../../stores/projectStore'
import { useChatStore } from '../../stores/chatStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { ProjectTree } from './ProjectTree'
import { SettingsPanel } from '../SettingsPanel'
import { GitBranch, ChevronDown, ChevronLeft, ChevronRight, Settings, Cloud, Terminal } from 'lucide-react'

export function Layout() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { currentWorkspace, addProject, setCurrentProject, setCurrentWorkspace, addWorkspace } = useProjectStore()
  const { setProjectId, clearMessages } = useChatStore()
  const { agentMode, claudeCodeStatus } = useSettingsStore()
  const projects = useProjectStore((state) => state.projects)

  const handleNewProject = () => {
    const newProject: Project = {
      id: crypto.randomUUID(),
      name: `project-${projects.length + 1}`,
      status: 'draft',
      workspaces: [],
    }
    addProject(newProject)
    setCurrentProject(newProject)
    setProjectId(newProject.id)
    clearMessages()

    // Auto-create first workspace
    const firstWorkspace: Workspace = {
      id: crypto.randomUUID(),
      branchName: 'main',
      location: 'local',
      lastActive: new Date(),
      status: 'working',
    }
    addWorkspace(newProject.id, firstWorkspace)
    setCurrentWorkspace(firstWorkspace)
  }

  const handleSelectWorkspace = (project: Project) => {
    setProjectId(project.id)
    clearMessages()
  }

  return (
    <div className="h-screen flex flex-col bg-neutral-950 text-white selection:bg-white selection:text-black">
      {/* Top Bar - Compact Header */}
      <header className="h-10 flex items-center justify-between px-3 bg-neutral-900 border-b border-white/10">
        {/* Left: Navigation arrows */}
        <div className="flex items-center gap-1">
          <button className="p-1.5 rounded hover:bg-white/10 text-neutral-500 hover:text-white transition-colors">
            <ChevronLeft size={16} />
          </button>
          <button className="p-1.5 rounded hover:bg-white/10 text-neutral-500 hover:text-white transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Center: Branch info */}
        <div className="flex items-center gap-2 text-sm">
          {currentWorkspace ? (
            <>
              <GitBranch size={14} className="text-neutral-500" />
              <span className="text-white font-medium">{currentWorkspace.branchName}</span>
              <ChevronRight size={12} className="text-neutral-600" />
              <button className="flex items-center gap-1 text-neutral-400 hover:text-white transition-colors">
                <span>origin/main</span>
                <ChevronDown size={12} />
              </button>
            </>
          ) : (
            <span className="text-neutral-500">No workspace selected</span>
          )}
        </div>

        {/* Right: Mode indicator + Settings */}
        <div className="flex items-center gap-3">
          {/* Mode indicator */}
          <div
            className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-xs ${
              agentMode === 'byoa'
                ? 'bg-purple-500/20 text-purple-300'
                : 'bg-blue-500/20 text-blue-300'
            }`}
          >
            {agentMode === 'byoa' ? (
              <>
                <Terminal size={12} />
                <span>BYOA</span>
                {claudeCodeStatus?.installed && claudeCodeStatus?.authenticated ? (
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                ) : (
                  <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
                )}
              </>
            ) : (
              <>
                <Cloud size={12} />
                <span>Cloud</span>
              </>
            )}
          </div>

          {/* Location dropdown */}
          {currentWorkspace && (
            <button className="flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-800 border border-white/10 text-xs text-neutral-300 hover:text-white hover:border-white/20 transition-colors">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>/{currentWorkspace.location}</span>
              <ChevronDown size={10} />
            </button>
          )}

          <div className="h-4 w-px bg-white/10" />

          {/* Settings button */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-1.5 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 border-r border-white/10 bg-neutral-900 flex flex-col">
          <ProjectTree
            onNewProject={handleNewProject}
            onSelectWorkspace={handleSelectWorkspace}
          />
        </aside>

        {/* Main area */}
        <div className="flex-1 bg-neutral-950 overflow-hidden">
          <Outlet />
        </div>
      </main>

      {/* Settings Panel */}
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
