import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GitBranch, Plus, MoreHorizontal, ChevronRight, Settings, FolderPlus } from 'lucide-react'
import { useProjectStore, type Project, type Workspace } from '../../stores/projectStore'
import { cn } from '@vibed/ui'

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

interface WorkspaceItemProps {
  workspace: Workspace
  project: Project
  index: number
  isActive: boolean
  onSelect: () => void
}

function WorkspaceItem({ workspace, project, index, isActive, onSelect }: WorkspaceItemProps) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ delay: index * 0.05 }}
      onClick={onSelect}
      className={cn(
        'w-full flex items-start gap-2 px-3 py-2 ml-2 rounded-lg text-left transition-colors',
        'hover:bg-white/5',
        isActive && 'bg-white/10'
      )}
    >
      {/* Branch icon or status indicator */}
      <div className="flex-shrink-0 mt-0.5">
        {workspace.status === 'working' ? (
          <div className="w-4 h-4 flex items-center justify-center">
            <motion.div
              className="w-2 h-2 rounded-full bg-emerald-400"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            />
          </div>
        ) : (
          <GitBranch size={16} className="text-neutral-500" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white truncate">{workspace.branchName}</span>
          {/* Git stats */}
          {(workspace.additions !== undefined || workspace.deletions !== undefined) && (
            <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700">
              {workspace.additions !== undefined && (
                <span className="text-emerald-400">+{workspace.additions}</span>
              )}
              {workspace.additions !== undefined && workspace.deletions !== undefined && ' '}
              {workspace.deletions !== undefined && (
                <span className="text-red-400">-{workspace.deletions}</span>
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span>{workspace.location}</span>
          <span>·</span>
          <span>{workspace.status === 'working' ? 'Working...' : formatTimeAgo(workspace.lastActive)}</span>
        </div>
      </div>

      {/* Keyboard shortcut */}
      <span className="flex-shrink-0 text-xs text-neutral-600 font-mono">
        ⌘{index + 1}
      </span>
    </motion.button>
  )
}

interface ProjectItemProps {
  project: Project
  globalWorkspaceIndex: number
  onSelectWorkspace: (project: Project, workspace: Workspace) => void
  onNewWorkspace: (projectId: string) => void
  currentWorkspaceId?: string
}

function ProjectItem({
  project,
  globalWorkspaceIndex,
  onSelectWorkspace,
  onNewWorkspace,
  currentWorkspaceId
}: ProjectItemProps) {
  const { toggleProjectExpanded } = useProjectStore()
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div className="border-b border-white/5 last:border-b-0">
      {/* Project Header */}
      <div className="flex items-center justify-between px-3 py-3 hover:bg-white/5 transition-colors">
        <button
          onClick={() => toggleProjectExpanded(project.id)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <motion.div
            animate={{ rotate: project.isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronRight size={14} className="text-neutral-500" />
          </motion.div>
          <span className="text-sm font-medium text-white">{project.name}</span>
        </button>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded hover:bg-white/10 text-neutral-500 hover:text-white transition-colors"
          >
            <MoreHorizontal size={16} />
          </button>

          {/* Dropdown Menu */}
          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute right-0 top-full mt-1 w-40 bg-neutral-900 border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden"
              >
                <button
                  onClick={() => {
                    onNewWorkspace(project.id)
                    setShowMenu(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                >
                  <Plus size={14} />
                  New workspace
                </button>
                <button
                  onClick={() => setShowMenu(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                >
                  <Settings size={14} />
                  Settings
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* New Workspace Button */}
      <button
        onClick={() => onNewWorkspace(project.id)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"
      >
        <Plus size={14} />
        New workspace
      </button>

      {/* Workspaces */}
      <AnimatePresence>
        {project.isExpanded && project.workspaces.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden pb-2"
          >
            {project.workspaces.map((workspace, idx) => (
              <WorkspaceItem
                key={workspace.id}
                workspace={workspace}
                project={project}
                index={globalWorkspaceIndex + idx}
                isActive={currentWorkspaceId === workspace.id}
                onSelect={() => onSelectWorkspace(project, workspace)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface ProjectTreeProps {
  onSelectWorkspace?: (project: Project, workspace: Workspace) => void
  onNewProject?: () => void
  onNewWorkspace?: (projectId: string) => void
}

export function ProjectTree({ onSelectWorkspace, onNewProject, onNewWorkspace }: ProjectTreeProps) {
  const { projects, currentWorkspace, addWorkspace, setCurrentProject, setCurrentWorkspace } = useProjectStore()

  const handleSelectWorkspace = (project: Project, workspace: Workspace) => {
    setCurrentProject(project)
    setCurrentWorkspace(workspace)
    onSelectWorkspace?.(project, workspace)
  }

  const handleNewWorkspace = (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (!project) return

    const newWorkspace: Workspace = {
      id: crypto.randomUUID(),
      branchName: `workspace-${project.workspaces.length + 1}`,
      location: 'local',
      lastActive: new Date(),
      status: 'idle',
    }
    addWorkspace(projectId, newWorkspace)
    onNewWorkspace?.(projectId)
  }

  // Calculate global workspace index for keyboard shortcuts
  let globalIndex = 0

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2 text-neutral-400">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            <path d="M2 12h20" />
          </svg>
          <span className="text-sm font-medium">Workspaces</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1.5 rounded hover:bg-white/10 text-neutral-500 hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button className="p-1.5 rounded hover:bg-white/10 text-neutral-500 hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Projects List */}
      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <FolderPlus size={20} className="text-neutral-500" />
            </div>
            <p className="text-sm text-neutral-500 mb-4">No projects yet</p>
            <button
              onClick={onNewProject}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/15 transition-colors"
            >
              <Plus size={14} />
              Create project
            </button>
          </div>
        ) : (
          projects.map((project) => {
            const startIndex = globalIndex
            globalIndex += project.workspaces.length
            return (
              <ProjectItem
                key={project.id}
                project={project}
                globalWorkspaceIndex={startIndex}
                onSelectWorkspace={handleSelectWorkspace}
                onNewWorkspace={handleNewWorkspace}
                currentWorkspaceId={currentWorkspace?.id}
              />
            )
          })
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 px-3 py-3">
        <button
          onClick={onNewProject}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <FolderPlus size={16} />
          Add repository
        </button>
      </div>
    </div>
  )
}

export default ProjectTree
