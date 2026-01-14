import { Outlet, Link, useLocation } from 'react-router-dom'
import { ConnectButton } from '../auth/ConnectButton'
import { useProjectStore, type Project } from '../../stores/projectStore'
import { useChatStore } from '../../stores/chatStore'
import { Button } from '@vibed/ui'

export function Layout() {
  const location = useLocation()
  const { projects, currentProject, setCurrentProject, addProject } = useProjectStore()
  const { setProjectId, clearMessages } = useChatStore()

  const handleNewProject = () => {
    const newProject: Project = {
      id: crypto.randomUUID(),
      name: `Project ${projects.length + 1}`,
      status: 'draft',
    }
    addProject(newProject)
    setCurrentProject(newProject)
    setProjectId(newProject.id)
    clearMessages()
  }

  const handleSelectProject = (project: Project) => {
    setCurrentProject(project)
    setProjectId(project.id)
    clearMessages() // For now, clear messages when switching projects
  }

  const isIDEPage = location.pathname === '/'

  return (
    <div className="h-screen flex flex-col bg-bg-primary">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center px-4 bg-bg-secondary">
        <Link to="/" className="text-xl font-bold text-gradient">
          vibed.fun
        </Link>

        {/* Navigation */}
        <nav className="ml-8 flex items-center gap-4">
          <Link
            to="/"
            className={`text-sm transition ${
              location.pathname === '/' ? 'text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Build
          </Link>
          <Link
            to="/discover"
            className={`text-sm transition ${
              location.pathname === '/discover' ? 'text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Discover
          </Link>
        </nav>

        <div className="flex-1" />

        <ConnectButton />
      </header>

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar - Only show on IDE page */}
        {isIDEPage && (
          <aside className="w-64 border-r border-border bg-bg-secondary p-4 flex flex-col">
            <Button
              variant="primary"
              className="w-full"
              onClick={handleNewProject}
            >
              + New Project
            </Button>

            <div className="mt-4 flex-1 overflow-y-auto">
              {projects.length === 0 ? (
                <div className="text-sm text-gray-500">
                  Your projects will appear here
                </div>
              ) : (
                <div className="space-y-2">
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => handleSelectProject(project)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                        currentProject?.id === project.id
                          ? 'bg-accent-green/20 text-accent-green border border-accent-green/30'
                          : 'text-gray-400 hover:bg-bg-tertiary hover:text-white'
                      }`}
                    >
                      <div className="font-medium truncate">{project.name}</div>
                      <div className="text-xs text-gray-600 capitalize">{project.status}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Main area */}
        <div className="flex-1 bg-bg-primary overflow-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
