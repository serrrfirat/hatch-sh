import { Outlet, Link, useLocation } from 'react-router-dom'
import { ConnectButton } from '../auth/ConnectButton'
import { useProjectStore, type Project, type Workspace } from '../../stores/projectStore'
import { useChatStore } from '../../stores/chatStore'
import { ProjectTree } from './ProjectTree'
import { GitBranch, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

export function Layout() {
  const location = useLocation()
  const { projects, currentProject, currentWorkspace, addProject, setCurrentProject, setCurrentWorkspace, addWorkspace } = useProjectStore()
  const { setProjectId, clearMessages } = useChatStore()

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

  const handleSelectWorkspace = (project: Project, workspace: Workspace) => {
    setProjectId(project.id)
    clearMessages()
  }

  const isIDEPage = location.pathname === '/'

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

        {/* Right: Location + Nav + Connect */}
        <div className="flex items-center gap-3">
          {/* Location dropdown */}
          {currentWorkspace && (
            <button className="flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-800 border border-white/10 text-xs text-neutral-300 hover:text-white hover:border-white/20 transition-colors">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>/{currentWorkspace.location}</span>
              <ChevronDown size={10} />
            </button>
          )}

          {/* Compact Nav Links */}
          <nav className="flex items-center gap-1">
            <Link
              to="/"
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                location.pathname === '/'
                  ? 'bg-white/10 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Build
            </Link>
            <Link
              to="/discover"
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                location.pathname === '/discover'
                  ? 'bg-white/10 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Discover
            </Link>
            <Link
              to="/marketplace"
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                location.pathname === '/marketplace'
                  ? 'bg-white/10 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Marketplace
            </Link>
          </nav>

          <div className="h-4 w-px bg-white/10" />

          {/* Compact Connect Button */}
          <ConnectButton />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar - Only show on IDE page */}
        {isIDEPage && (
          <aside className="w-72 border-r border-white/10 bg-neutral-900 flex flex-col">
            <ProjectTree
              onNewProject={handleNewProject}
              onSelectWorkspace={handleSelectWorkspace}
            />
          </aside>
        )}

        {/* Main area */}
        <div className="flex-1 bg-neutral-950 overflow-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
