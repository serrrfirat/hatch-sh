import { create } from 'zustand'

export interface Project {
  id: string
  name: string
  code?: string
  deploymentUrl?: string
  tokenAddress?: string
  status: 'draft' | 'deployed' | 'launched'
}

interface ProjectState {
  currentProject: Project | null
  projects: Project[]
  setCurrentProject: (project: Project | null) => void
  updateProjectCode: (code: string) => void
  addProject: (project: Project) => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: null,
  projects: [],

  setCurrentProject: (currentProject) => set({ currentProject }),

  updateProjectCode: (code) => {
    const { currentProject } = get()
    if (currentProject) {
      const updatedProject = { ...currentProject, code }
      set((state) => ({
        currentProject: updatedProject,
        // Also update the project in the projects array to maintain consistency
        projects: state.projects.map((p) =>
          p.id === currentProject.id ? updatedProject : p
        ),
      }))
    }
  },

  addProject: (project) => {
    set((state) => ({
      projects: [...state.projects, project],
    }))
  },
}))
