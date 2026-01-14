import { create } from 'zustand'

export interface Workspace {
  id: string
  branchName: string
  location: string // e.g., "sydney-v1", "mumbai"
  lastActive: Date
  additions?: number
  deletions?: number
  status: 'working' | 'idle' | 'error'
}

export interface Project {
  id: string
  name: string
  code?: string
  deploymentUrl?: string
  tokenAddress?: string
  status: 'draft' | 'deployed' | 'launched'
  workspaces: Workspace[]
  isExpanded?: boolean
}

interface ProjectState {
  currentProject: Project | null
  currentWorkspace: Workspace | null
  projects: Project[]
  setCurrentProject: (project: Project | null) => void
  setCurrentWorkspace: (workspace: Workspace | null) => void
  updateProjectCode: (code: string) => void
  addProject: (project: Project) => void
  addWorkspace: (projectId: string, workspace: Workspace) => void
  toggleProjectExpanded: (projectId: string) => void
  updateWorkspaceStats: (projectId: string, workspaceId: string, additions: number, deletions: number) => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: null,
  currentWorkspace: null,
  projects: [],

  setCurrentProject: (currentProject) => set({ currentProject }),

  setCurrentWorkspace: (currentWorkspace) => set({ currentWorkspace }),

  updateProjectCode: (code) => {
    const { currentProject } = get()
    if (currentProject) {
      const updatedProject = { ...currentProject, code }
      set((state) => ({
        currentProject: updatedProject,
        projects: state.projects.map((p) =>
          p.id === currentProject.id ? updatedProject : p
        ),
      }))
    }
  },

  addProject: (project) => {
    set((state) => ({
      projects: [...state.projects, { ...project, workspaces: project.workspaces || [], isExpanded: true }],
    }))
  },

  addWorkspace: (projectId, workspace) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? { ...p, workspaces: [...p.workspaces, workspace] }
          : p
      ),
    }))
  },

  toggleProjectExpanded: (projectId) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId ? { ...p, isExpanded: !p.isExpanded } : p
      ),
    }))
  },

  updateWorkspaceStats: (projectId, workspaceId, additions, deletions) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              workspaces: p.workspaces.map((w) =>
                w.id === workspaceId ? { ...w, additions, deletions } : w
              ),
            }
          : p
      ),
    }))
  },
}))
