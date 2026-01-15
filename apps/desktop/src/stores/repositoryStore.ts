import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import * as gitBridge from '../lib/git/bridge'
import * as githubBridge from '../lib/github/bridge'
import type { Repository, GitStatus } from '../lib/git/bridge'
import type { GitHubAuthState } from '../lib/github/bridge'

export interface Workspace {
  id: string
  repositoryId: string
  branchName: string
  localPath: string
  status: 'idle' | 'working' | 'error'
  lastActive: Date
  additions?: number
  deletions?: number
  // PR tracking
  prNumber?: number
  prUrl?: string
  prState?: 'open' | 'merged'
}

interface RepositoryState {
  // GitHub auth
  githubAuth: GitHubAuthState | null
  isAuthenticating: boolean
  authError: string | null

  // Repositories
  repositories: Repository[]
  currentRepository: Repository | null

  // Workspaces
  workspaces: Workspace[]
  currentWorkspace: Workspace | null

  // Loading states
  isCloning: boolean
  cloneProgress: string | null

  // Actions - Auth
  checkGitHubAuth: () => Promise<void>
  startGitHubLogin: () => Promise<{ userCode: string; verificationUri: string }>
  completeGitHubLogin: (userCode: string) => Promise<void>
  signOutGitHub: () => Promise<void>

  // Actions - Repositories
  cloneRepository: (url: string) => Promise<Repository>
  openLocalRepository: (path: string) => Promise<Repository>
  createNewRepository: (name: string, isPrivate: boolean) => Promise<Repository>
  setCurrentRepository: (repo: Repository | null) => void
  removeRepository: (id: string) => void

  // Actions - Workspaces
  createWorkspace: (repositoryId: string) => Promise<Workspace>
  setCurrentWorkspace: (workspace: Workspace | null) => void
  updateWorkspaceStatus: (workspaceId: string, status: Workspace['status']) => void
  updateWorkspaceStats: (workspaceId: string, additions: number, deletions: number) => void
  removeWorkspace: (workspaceId: string) => Promise<void>

  // Actions - Git operations
  getGitStatus: (workspaceId: string) => Promise<GitStatus>
  commitChanges: (workspaceId: string, message: string) => Promise<string>
  pushChanges: (workspaceId: string) => Promise<void>
  createPullRequest: (workspaceId: string, title: string, body: string) => Promise<string>
  mergePullRequest: (workspaceId: string, mergeMethod?: string) => Promise<void>
}

export const useRepositoryStore = create<RepositoryState>()(
  persist(
    (set, get) => ({
      // Initial state
      githubAuth: null,
      isAuthenticating: false,
      authError: null,
      repositories: [],
      currentRepository: null,
      workspaces: [],
      currentWorkspace: null,
      isCloning: false,
      cloneProgress: null,

      // Auth actions
      checkGitHubAuth: async () => {
        try {
          const auth = await githubBridge.getAuthState()
          set({ githubAuth: auth, authError: null })
        } catch (error) {
          set({ authError: error instanceof Error ? error.message : 'Failed to check auth' })
        }
      },

      startGitHubLogin: async () => {
        set({ isAuthenticating: true, authError: null })
        try {
          const result = await githubBridge.startDeviceFlow()
          return {
            userCode: result.user_code,
            verificationUri: result.verification_uri,
          }
        } catch (error) {
          set({ isAuthenticating: false, authError: error instanceof Error ? error.message : 'Login failed' })
          throw error
        }
      },

      completeGitHubLogin: async (userCode: string) => {
        try {
          const auth = await githubBridge.pollForToken(userCode)
          set({ githubAuth: auth, isAuthenticating: false, authError: null })
        } catch (error) {
          set({ isAuthenticating: false, authError: error instanceof Error ? error.message : 'Login failed' })
          throw error
        }
      },

      signOutGitHub: async () => {
        try {
          await githubBridge.signOut()
          set({ githubAuth: null })
        } catch (error) {
          console.error('Sign out error:', error)
        }
      },

      // Repository actions
      cloneRepository: async (url: string) => {
        set({ isCloning: true, cloneProgress: 'Cloning repository...' })
        try {
          const repoName = gitBridge.extractRepoName(url)
          const repo = await gitBridge.cloneRepo(url, repoName)

          set((state) => ({
            repositories: [...state.repositories, repo],
            currentRepository: repo,
            isCloning: false,
            cloneProgress: null,
          }))

          return repo
        } catch (error) {
          set({ isCloning: false, cloneProgress: null })
          throw error
        }
      },

      openLocalRepository: async (path: string) => {
        try {
          const repo = await gitBridge.openLocalRepo(path)

          // Check if already added
          const existing = get().repositories.find((r) => r.local_path === repo.local_path)
          if (existing) {
            set({ currentRepository: existing })
            return existing
          }

          set((state) => ({
            repositories: [...state.repositories, repo],
            currentRepository: repo,
          }))

          return repo
        } catch (error) {
          throw error
        }
      },

      createNewRepository: async (name: string, isPrivate: boolean) => {
        set({ isCloning: true, cloneProgress: 'Creating repository...' })
        try {
          const repo = await gitBridge.createGitHubRepo(name, isPrivate)

          set((state) => ({
            repositories: [...state.repositories, repo],
            currentRepository: repo,
            isCloning: false,
            cloneProgress: null,
          }))

          return repo
        } catch (error) {
          set({ isCloning: false, cloneProgress: null })
          throw error
        }
      },

      setCurrentRepository: (repo) => set({ currentRepository: repo }),

      removeRepository: (id) => {
        set((state) => ({
          repositories: state.repositories.filter((r) => r.id !== id),
          workspaces: state.workspaces.filter((w) => w.repositoryId !== id),
          currentRepository: state.currentRepository?.id === id ? null : state.currentRepository,
          currentWorkspace:
            state.currentWorkspace && state.workspaces.find((w) => w.id === state.currentWorkspace?.id)?.repositoryId === id
              ? null
              : state.currentWorkspace,
        }))
      },

      // Workspace actions
      createWorkspace: async (repositoryId: string) => {
        const repo = get().repositories.find((r) => r.id === repositoryId)
        if (!repo) {
          throw new Error('Repository not found')
        }

        const workspaceId = crypto.randomUUID()

        try {
          const branchName = await gitBridge.createWorkspaceBranch(repo.local_path, workspaceId)

          const workspace: Workspace = {
            id: workspaceId,
            repositoryId,
            branchName,
            localPath: repo.local_path,
            status: 'idle',
            lastActive: new Date(),
          }

          set((state) => ({
            workspaces: [...state.workspaces, workspace],
            currentWorkspace: workspace,
          }))

          return workspace
        } catch (error) {
          throw error
        }
      },

      setCurrentWorkspace: (workspace) => {
        set({ currentWorkspace: workspace })

        // Also update current repository if workspace is set
        if (workspace) {
          const repo = get().repositories.find((r) => r.id === workspace.repositoryId)
          if (repo) {
            set({ currentRepository: repo })
          }
        }
      },

      updateWorkspaceStatus: (workspaceId, status) => {
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === workspaceId ? { ...w, status, lastActive: new Date() } : w
          ),
          currentWorkspace:
            state.currentWorkspace?.id === workspaceId
              ? { ...state.currentWorkspace, status, lastActive: new Date() }
              : state.currentWorkspace,
        }))
      },

      updateWorkspaceStats: (workspaceId, additions, deletions) => {
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === workspaceId ? { ...w, additions, deletions } : w
          ),
          currentWorkspace:
            state.currentWorkspace?.id === workspaceId
              ? { ...state.currentWorkspace, additions, deletions }
              : state.currentWorkspace,
        }))
      },

      removeWorkspace: async (workspaceId) => {
        const workspace = get().workspaces.find((w) => w.id === workspaceId)

        if (workspace) {
          // Delete the branch from local git
          try {
            await gitBridge.deleteWorkspaceBranch(workspace.localPath, workspace.branchName)
          } catch (error) {
            console.error('Failed to delete workspace branch:', error)
            // Continue with removing from state even if git delete fails
          }
        }

        set((state) => ({
          workspaces: state.workspaces.filter((w) => w.id !== workspaceId),
          currentWorkspace:
            state.currentWorkspace?.id === workspaceId ? null : state.currentWorkspace,
        }))
      },

      // Git operations
      getGitStatus: async (workspaceId: string) => {
        const workspace = get().workspaces.find((w) => w.id === workspaceId)
        if (!workspace) {
          throw new Error('Workspace not found')
        }

        const status = await gitBridge.getGitStatus(workspace.localPath)

        // Update workspace stats
        const additions = status.staged.length + status.modified.length + status.untracked.length
        const deletions = 0 // Would need to parse diff for accurate count
        get().updateWorkspaceStats(workspaceId, additions, deletions)

        return status
      },

      commitChanges: async (workspaceId: string, message: string) => {
        const workspace = get().workspaces.find((w) => w.id === workspaceId)
        if (!workspace) {
          throw new Error('Workspace not found')
        }

        get().updateWorkspaceStatus(workspaceId, 'working')

        try {
          const hash = await gitBridge.commitChanges(workspace.localPath, message)
          get().updateWorkspaceStatus(workspaceId, 'idle')
          return hash
        } catch (error) {
          get().updateWorkspaceStatus(workspaceId, 'error')
          throw error
        }
      },

      pushChanges: async (workspaceId: string) => {
        const workspace = get().workspaces.find((w) => w.id === workspaceId)
        if (!workspace) {
          throw new Error('Workspace not found')
        }

        get().updateWorkspaceStatus(workspaceId, 'working')

        try {
          await gitBridge.pushChanges(workspace.localPath, workspace.branchName)
          get().updateWorkspaceStatus(workspaceId, 'idle')
        } catch (error) {
          get().updateWorkspaceStatus(workspaceId, 'error')
          throw error
        }
      },

      createPullRequest: async (workspaceId: string, title: string, body: string) => {
        const workspace = get().workspaces.find((w) => w.id === workspaceId)
        if (!workspace) {
          throw new Error('Workspace not found')
        }

        const repo = get().repositories.find((r) => r.id === workspace.repositoryId)
        if (!repo) {
          throw new Error('Repository not found')
        }

        // Push changes first
        await gitBridge.pushChanges(workspace.localPath, workspace.branchName)

        // Create PR
        const prUrl = await gitBridge.createPR(
          repo.full_name,
          workspace.branchName,
          repo.default_branch,
          title,
          body
        )

        // Extract PR number from URL (e.g., https://github.com/owner/repo/pull/123)
        const prNumber = parseInt(prUrl.split('/').pop() || '0', 10)

        // Update workspace with PR info
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === workspaceId
              ? { ...w, prNumber, prUrl, prState: 'open' as const }
              : w
          ),
          currentWorkspace: state.currentWorkspace?.id === workspaceId
            ? { ...state.currentWorkspace, prNumber, prUrl, prState: 'open' as const }
            : state.currentWorkspace,
        }))

        return prUrl
      },

      mergePullRequest: async (workspaceId: string, mergeMethod: string = 'squash') => {
        const workspace = get().workspaces.find((w) => w.id === workspaceId)
        if (!workspace) {
          throw new Error('Workspace not found')
        }

        if (!workspace.prNumber) {
          throw new Error('No PR associated with this workspace')
        }

        const repo = get().repositories.find((r) => r.id === workspace.repositoryId)
        if (!repo) {
          throw new Error('Repository not found')
        }

        // Merge the PR
        const result = await gitBridge.mergePullRequest(
          repo.full_name,
          workspace.prNumber,
          mergeMethod
        )

        if (!result.merged) {
          throw new Error(result.message || 'Failed to merge PR')
        }

        // Update workspace state to merged
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === workspaceId
              ? { ...w, prState: 'merged' as const }
              : w
          ),
          currentWorkspace: state.currentWorkspace?.id === workspaceId
            ? { ...state.currentWorkspace, prState: 'merged' as const }
            : state.currentWorkspace,
        }))
      },
    }),
    {
      name: 'vibed-repositories',
      partialize: (state) => ({
        repositories: state.repositories,
        workspaces: state.workspaces.map((w) => ({
          ...w,
          status: 'idle' as const, // Reset status on reload
          lastActive: w.lastActive,
        })),
        // Don't persist auth - load from disk on startup
      }),
    }
  )
)

// Selectors
export const selectRepositoryWorkspaces = (repositoryId: string) => (state: RepositoryState) =>
  state.workspaces.filter((w) => w.repositoryId === repositoryId)

export const selectIsAuthenticated = (state: RepositoryState) =>
  state.githubAuth?.is_authenticated ?? false
