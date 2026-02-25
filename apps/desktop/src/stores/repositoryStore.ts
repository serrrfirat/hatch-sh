import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import * as gitBridge from '../lib/git/bridge'
import * as githubBridge from '../lib/github/bridge'
import type { Repository, GitStatus } from '../lib/git/bridge'
import type { GitHubAuthState } from '../lib/github/bridge'
import { useChatStore } from './chatStore'
import type { AgentId } from '../lib/agents/types'
import type { PlanContent } from '../lib/ideaMaze/types'
import { DEFAULT_AGENT_ID, isValidAgentId } from '../lib/agents/registry'
import { generateWorkspaceName } from '../lib/pokemon'
import { useSettingsStore } from './settingsStore'
import { mapGitError } from '../lib/git/errorMapper'
import { useToastStore } from './toastStore'

export type WorkspaceStatus = 'backlog' | 'in-review' | 'done'

function normalizeWorkspaceStatus(value: string | undefined): WorkspaceStatus {
  if (value === 'in-review' || value === 'done') {
    return value
  }
  return 'backlog'
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return String(error ?? 'Unknown git error')
}

function notifyMappedGitError(
  error: unknown,
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void
): void {
  const mapped = mapGitError(getErrorMessage(error))

  addNotification({
    message: mapped.message,
    action: mapped.action,
    actionLabel: mapped.actionLabel,
    type: 'warning',
  })

  useToastStore.getState().showToast({
    message: mapped.message,
    type: 'warning',
    dismissTimeout: 6000,
  })
}

export interface Workspace {
  id: string
  repositoryId: string
  branchName: string
  localPath: string // Path to the worktree (isolated working directory)
  repoPath: string // Path to the main repository
  status: 'idle' | 'working' | 'error'
  lastActive: Date
  additions?: number
  deletions?: number
  agentId: AgentId
  // Initialization state
  isInitializing?: boolean
  // PR tracking
  prNumber?: number
  prUrl?: string
  prState?: 'open' | 'merged'
  // Plan reference from Idea Maze
  sourcePlan?: PlanContent
  sourcePlanId?: string
  workspaceStatus: WorkspaceStatus
}

export interface Notification {
  id: string
  message: string
  action?: string
  actionLabel?: string
  type: 'error' | 'warning' | 'success' | 'info'
  timestamp: Date
}

type PendingAuthRetryOperation =
  | {
      type: 'cloneRepository'
      url: string
    }
  | {
      type: 'pushChanges'
      workspaceId: string
    }
  | {
      type: 'createPullRequest'
      workspaceId: string
      title: string
      body: string
    }

interface RepositoryState {
  // GitHub auth
  githubAuth: GitHubAuthState | null
  isAuthenticating: boolean
  authError: string | null
  isGhInstalled: boolean | null
  pendingAuthRetry: PendingAuthRetryOperation | null

  // Repositories
  repositories: Repository[]
  currentRepository: Repository | null

  // Workspaces
  workspaces: Workspace[]
  currentWorkspace: Workspace | null

  // Loading states
  isCloning: boolean
  cloneProgress: string | null

  // Notifications
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void

  // Actions - Auth
  checkGhInstalled: () => Promise<void>
  checkGitHubAuth: () => Promise<void>
  loginWithGitHub: () => Promise<void>
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
  updateWorkspaceWorkflowStatus: (workspaceId: string, workspaceStatus: WorkspaceStatus) => void
  updateWorkspaceStats: (workspaceId: string, additions: number, deletions: number) => void
  updateWorkspaceAgent: (workspaceId: string, agentId: AgentId) => void
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
      isGhInstalled: null,
      pendingAuthRetry: null,
      repositories: [],
      currentRepository: null,
      workspaces: [],
      currentWorkspace: null,
      isCloning: false,
      cloneProgress: null,
      notifications: [],

      // Auth actions
      checkGhInstalled: async () => {
        try {
          const installed = await githubBridge.checkGhInstalled()
          set({ isGhInstalled: installed })
        } catch {
          set({ isGhInstalled: false })
        }
      },

      // Notification actions
      addNotification: (notification) => {
        const id = `${Date.now()}-${Math.random()}`
        set((state) => ({
          notifications: [...state.notifications, { ...notification, id, timestamp: new Date() }],
        }))
      },

      removeNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }))
      },

      clearNotifications: () => {
        set({ notifications: [] })
      },

      checkGitHubAuth: async () => {
        try {
          const auth = await githubBridge.getAuthState()
          set({ githubAuth: auth, authError: null })
        } catch (error) {
          set({ authError: error instanceof Error ? error.message : 'Failed to check auth' })
        }
      },

      loginWithGitHub: async () => {
        set({ isAuthenticating: true, authError: null })
        try {
          const auth = await githubBridge.login()

          const pendingRetry = get().pendingAuthRetry

          set({
            githubAuth: auth,
            isAuthenticating: false,
            authError: null,
            pendingAuthRetry: null,
          })

          useSettingsStore.getState().clearAuthExpired()

          if (pendingRetry) {
            switch (pendingRetry.type) {
              case 'cloneRepository':
                await get().cloneRepository(pendingRetry.url)
                break
              case 'pushChanges':
                await get().pushChanges(pendingRetry.workspaceId)
                break
              case 'createPullRequest':
                await get().createPullRequest(
                  pendingRetry.workspaceId,
                  pendingRetry.title,
                  pendingRetry.body
                )
                break
            }

            get().addNotification({
              message: 'GitHub re-authenticated. Retried your last operation automatically.',
              type: 'success',
            })
          }
        } catch (error) {
          set({
            isAuthenticating: false,
            authError: error instanceof Error ? error.message : 'Login failed',
          })
          throw error
        }
      },

      signOutGitHub: async () => {
        try {
          await githubBridge.signOut()
          set({ githubAuth: null })
        } catch {
          // intentionally empty
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
          notifyMappedGitError(error, get().addNotification)
          if (githubBridge.isAuthExpiredError(error)) {
            useSettingsStore.getState().setAuthExpired(true)
            set({
              pendingAuthRetry: {
                type: 'cloneRepository',
                url,
              },
            })
          }
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
          notifyMappedGitError(error, get().addNotification)
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
          notifyMappedGitError(error, get().addNotification)
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
            state.currentWorkspace &&
            state.workspaces.find((w) => w.id === state.currentWorkspace?.id)?.repositoryId === id
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

        // Get existing workspace names to avoid collisions
        const existingNames = get().workspaces.map((w) => w.id)
        const workspaceId = generateWorkspaceName(existingNames)

        // Get the current global agent mode to use as default for new workspaces
        const globalAgentMode = useSettingsStore.getState().agentMode
        // Use global agent mode if it's a valid agent ID, otherwise fall back to default
        const defaultAgentId: AgentId =
          globalAgentMode !== 'cloud' && isValidAgentId(globalAgentMode)
            ? globalAgentMode
            : DEFAULT_AGENT_ID

        // Create workspace immediately with isInitializing=true for visual feedback
        const initializingWorkspace: Workspace = {
          id: workspaceId,
          repositoryId,
          branchName: `workspace/${workspaceId}`, // Temporary, will be updated
          localPath: '', // Will be set after worktree creation
          repoPath: repo.local_path,
          status: 'idle',
          lastActive: new Date(),
          agentId: defaultAgentId,
          isInitializing: true,
          workspaceStatus: 'backlog' as const,
        }

        // Add to store immediately so it shows in the sidebar
        set((state) => ({
          workspaces: [...state.workspaces, initializingWorkspace],
          currentWorkspace: initializingWorkspace,
        }))

        // Sync workspace ID with chat store for per-workspace messages
        useChatStore.getState().setWorkspaceId(workspaceId)

        try {
          // Create workspace with isolated worktree
          const result = await gitBridge.worktreeCreate(repo.local_path, workspaceId)

          const workspace: Workspace = {
            id: workspaceId,
            repositoryId,
            branchName: result.branch_name,
            localPath: result.worktree_path, // Use the isolated worktree path
            repoPath: repo.local_path, // Keep reference to main repo
            status: 'idle',
            lastActive: new Date(),
            agentId: defaultAgentId,
            isInitializing: false,
            workspaceStatus: 'backlog' as const,
          }

          // Update the workspace with the real data
          set((state) => ({
            workspaces: state.workspaces.map((w) => (w.id === workspaceId ? workspace : w)),
            currentWorkspace: workspace,
          }))

          return workspace
        } catch (error) {
          // Remove the initializing workspace on error
          set((state) => ({
            workspaces: state.workspaces.filter((w) => w.id !== workspaceId),
            currentWorkspace:
              state.currentWorkspace?.id === workspaceId ? null : state.currentWorkspace,
          }))
          useChatStore.getState().setWorkspaceId(null)
          throw error
        }
      },

      setCurrentWorkspace: (workspace) => {
        set({ currentWorkspace: workspace })

        // Sync workspace ID with chat store for per-workspace messages
        useChatStore.getState().setWorkspaceId(workspace?.id || null)

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

      updateWorkspaceWorkflowStatus: (workspaceId, workspaceStatus) => {
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === workspaceId
              ? {
                  ...w,
                  workspaceStatus: normalizeWorkspaceStatus(workspaceStatus),
                  lastActive: new Date(),
                }
              : w
          ),
          currentWorkspace:
            state.currentWorkspace?.id === workspaceId
              ? {
                  ...state.currentWorkspace,
                  workspaceStatus: normalizeWorkspaceStatus(workspaceStatus),
                  lastActive: new Date(),
                }
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

      updateWorkspaceAgent: (workspaceId, agentId) => {
        set((state) => ({
          workspaces: state.workspaces.map((w) => (w.id === workspaceId ? { ...w, agentId } : w)),
          currentWorkspace:
            state.currentWorkspace?.id === workspaceId
              ? { ...state.currentWorkspace, agentId }
              : state.currentWorkspace,
        }))
      },

      removeWorkspace: async (workspaceId) => {
        const workspace = get().workspaces.find((w) => w.id === workspaceId)

        if (workspace) {
          // Delete the worktree and branch from git
          try {
            await gitBridge.worktreeRemove(
              workspace.repoPath,
              workspace.localPath,
              workspace.branchName
            )
          } catch (_error) {
            void _error
            // Continue with removing from state even if git delete fails
          }
        }

        const wasCurrentWorkspace = get().currentWorkspace?.id === workspaceId

        set((state) => ({
          workspaces: state.workspaces.filter((w) => w.id !== workspaceId),
          currentWorkspace:
            state.currentWorkspace?.id === workspaceId ? null : state.currentWorkspace,
        }))

        // Clear workspace ID in chat store if this was the current workspace
        if (wasCurrentWorkspace) {
          useChatStore.getState().setWorkspaceId(null)
        }
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
          notifyMappedGitError(error, get().addNotification)
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
          notifyMappedGitError(error, get().addNotification)
          if (githubBridge.isAuthExpiredError(error)) {
            useSettingsStore.getState().setAuthExpired(true)
            set({
              pendingAuthRetry: {
                type: 'pushChanges',
                workspaceId,
              },
            })
          }
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

        let prUrl: string
        try {
          await gitBridge.pushChanges(workspace.localPath, workspace.branchName)
          prUrl = await gitBridge.createPR(
            repo.full_name,
            workspace.branchName,
            repo.default_branch,
            title,
            body
          )
        } catch (error) {
          notifyMappedGitError(error, get().addNotification)
          if (githubBridge.isAuthExpiredError(error)) {
            useSettingsStore.getState().setAuthExpired(true)
            set({
              pendingAuthRetry: {
                type: 'createPullRequest',
                workspaceId,
                title,
                body,
              },
            })
          }
          throw error
        }

        // Extract PR number from URL (e.g., https://github.com/owner/repo/pull/123)
        const prNumber = parseInt(prUrl.split('/').pop() || '0', 10)

        // Update workspace with PR info
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === workspaceId ? { ...w, prNumber, prUrl, prState: 'open' as const } : w
          ),
          currentWorkspace:
            state.currentWorkspace?.id === workspaceId
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

        let result: Awaited<ReturnType<typeof gitBridge.mergePullRequest>>
        try {
          result = await gitBridge.mergePullRequest(repo.full_name, workspace.prNumber, mergeMethod)
        } catch (error) {
          notifyMappedGitError(error, get().addNotification)
          throw error
        }

        if (!result.merged) {
          const mergeError = new Error(result.message || 'Failed to merge PR')
          notifyMappedGitError(mergeError, get().addNotification)
          throw mergeError
        }

        // Update workspace state to merged
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === workspaceId ? { ...w, prState: 'merged' as const } : w
          ),
          currentWorkspace:
            state.currentWorkspace?.id === workspaceId
              ? { ...state.currentWorkspace, prState: 'merged' as const }
              : state.currentWorkspace,
        }))
      },
    }),
    {
      name: 'hatch-repositories',
      partialize: (state) => ({
        repositories: state.repositories,
        // Filter out initializing workspaces (incomplete) and reset transient state
        workspaces: state.workspaces
          .filter((w) => !w.isInitializing) // Don't persist incomplete workspaces
          .map((w) => ({
            ...w,
            workspaceStatus: normalizeWorkspaceStatus(w.workspaceStatus),
            status: 'idle' as const, // Reset status on reload
            lastActive: w.lastActive,
            agentId: w.agentId || DEFAULT_AGENT_ID, // Ensure agentId is always set
            isInitializing: false, // Ensure isInitializing is always false on reload
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
